#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, Url, WebviewWindow};

struct Supervisor {
	child: Mutex<Option<Child>>,
	postgres: PathBuf,
	cluster: PathBuf,
}

fn crm_home() -> PathBuf {
	if let Ok(override_path) = std::env::var("OPENVZ_CRM_HOME") {
		if !override_path.is_empty() {
			return PathBuf::from(override_path);
		}
	}

	#[cfg(target_os = "macos")]
	{
		let home = std::env::var("HOME").unwrap_or_default();
		return PathBuf::from(home)
			.join("Library")
			.join("Application Support")
			.join("OPENVZ CRM");
	}

	#[cfg(target_os = "windows")]
	{
		let base = std::env::var("APPDATA").unwrap_or_default();
		return PathBuf::from(base).join("OPENVZ CRM");
	}

	#[cfg(all(unix, not(target_os = "macos")))]
	{
		let home = std::env::var("HOME").unwrap_or_default();
		let base = std::env::var("XDG_DATA_HOME")
			.ok()
			.filter(|value| !value.is_empty())
			.map(PathBuf::from)
			.unwrap_or_else(|| PathBuf::from(&home).join(".local").join("share"));

		return base.join("openvz-crm");
	}
}

fn executable(directory: &Path, name: &str) -> PathBuf {
	if cfg!(windows) {
		directory.join(format!("{name}.exe"))
	} else {
		directory.join(name)
	}
}

fn unpack(tarball: &Path, runtime: &Path, version: &str) -> Result<(), String> {
	let stamp = runtime.join(".payload-version");

	if let Ok(installed) = fs::read_to_string(&stamp) {
		if installed.trim() == version {
			return Ok(());
		}
	}

	if runtime.exists() {
		fs::remove_dir_all(runtime).map_err(|error| error.to_string())?;
	}

	fs::create_dir_all(runtime).map_err(|error| error.to_string())?;

	let status = Command::new("tar")
		.arg("-xzf")
		.arg(tarball)
		.arg("-C")
		.arg(runtime)
		.status()
		.map_err(|error| format!("tar could not run: {error}"))?;

	if !status.success() {
		return Err(format!("tar exited with {status}"));
	}

	fs::write(&stamp, version).map_err(|error| error.to_string())?;

	Ok(())
}

fn read_lines(window: WebviewWindow, output: impl Read + Send + 'static) {
	thread::spawn(move || {
		for line in BufReader::new(output).lines().map_while(Result::ok) {
			let (event, detail) = match line.split_once(' ') {
				Some((head, rest)) => (head, rest.to_string()),
				None => (line.as_str(), String::new()),
			};

			match event {
				"ready" => {
					if let Ok(url) = Url::parse(&detail) {
						let _ = window.navigate(url);
					}
				}
				"stage" => {
					let _ = window.emit("stage", detail);
				}
				"failed" => {
					let _ = window.emit("failed", detail);
				}
				_ => {}
			}
		}
	});
}

fn start(app: &AppHandle) -> Result<Supervisor, String> {
	let window = app
		.get_webview_window("main")
		.ok_or_else(|| "The window is missing.".to_string())?;

	let tarball = app
		.path()
		.resolve("payload.tar.gz", tauri::path::BaseDirectory::Resource)
		.map_err(|error| error.to_string())?;

	let home = crm_home();
	let runtime = home.join("runtime");
	let version = app.package_info().version.to_string();

	let _ = window.emit("stage", "unpacking");
	unpack(&tarball, &runtime, &version)?;

	let mut child = Command::new(executable(&runtime, "bun"))
		.arg(runtime.join("supervisor.js"))
		.env("OPENVZ_CRM_RUNTIME", &runtime)
		.env("OPENVZ_CRM_HOME", &home)
		.current_dir(&runtime)
		.stdout(Stdio::piped())
		.stderr(Stdio::piped())
		.spawn()
		.map_err(|error| format!("The server could not start: {error}"))?;

	if let Some(stdout) = child.stdout.take() {
		read_lines(window.clone(), stdout);
	}

	if let Some(stderr) = child.stderr.take() {
		let failing = window.clone();
		thread::spawn(move || {
			for line in BufReader::new(stderr).lines().map_while(Result::ok) {
				let _ = failing.emit("failed", line);
			}
		});
	}

	Ok(Supervisor {
		child: Mutex::new(Some(child)),
		postgres: runtime.join("postgres"),
		cluster: home.join("postgres").join("data"),
	})
}

fn stop(supervisor: &Supervisor) {
	let mut held = match supervisor.child.lock() {
		Ok(held) => held,
		Err(poisoned) => poisoned.into_inner(),
	};

	if let Some(mut child) = held.take() {
		#[cfg(unix)]
		unsafe {
			libc::kill(child.id() as i32, libc::SIGTERM);
		}

		#[cfg(not(unix))]
		let _ = child.kill();

		for _ in 0..60 {
			match child.try_wait() {
				Ok(Some(_)) => break,
				Ok(None) => thread::sleep(Duration::from_millis(250)),
				Err(_) => break,
			}
		}

		let _ = child.kill();
		let _ = child.wait();
	}

	let _ = Command::new(executable(&supervisor.postgres.join("bin"), "pg_ctl"))
		.arg("--pgdata")
		.arg(&supervisor.cluster)
		.arg("--mode")
		.arg("fast")
		.arg("--wait")
		.arg("--timeout")
		.arg("30")
		.arg("stop")
		.stdout(Stdio::null())
		.stderr(Stdio::null())
		.status();
}

fn main() {
	let app = tauri::Builder::default()
		.setup(|app| {
			let handle = app.handle().clone();

			match start(&handle) {
				Ok(supervisor) => {
					app.manage(supervisor);
				}
				Err(error) => {
					if let Some(window) = handle.get_webview_window("main") {
						let _ = window.emit("failed", error);
					}
				}
			}

			Ok(())
		})
		.build(tauri::generate_context!())
		.expect("OPENVZ CRM could not start");

	app.run(|handle, event| {
		if let RunEvent::Exit = event {
			if let Some(supervisor) = handle.try_state::<Supervisor>() {
				stop(&supervisor);
			}
		}
	});
}
