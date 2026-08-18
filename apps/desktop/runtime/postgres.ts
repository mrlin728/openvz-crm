import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Layout } from "./paths";

export const ROLE = "openvz";
export const DATABASE = "openvz_crm";
export const ADMIN_DATABASE = "postgres";

export interface Cluster {
	port: number;
	user: string;
	password: string;
	database: string;
}

export function newPassword(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString(
		"hex",
	);
}

function binary(postgresRoot: string, name: string): string {
	const suffix = process.platform === "win32" ? ".exe" : "";
	return join(postgresRoot, "bin", `${name}${suffix}`);
}

export function connectionUrl(cluster: Cluster): string {
	const auth = `${encodeURIComponent(cluster.user)}:${encodeURIComponent(cluster.password)}`;
	return `postgresql://${auth}@127.0.0.1:${cluster.port}/${cluster.database}?sslmode=disable`;
}

async function run(
	command: string,
	args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			resolve({ code: code ?? -1, stdout, stderr });
		});
	});
}

export function clusterExists(layout: Layout): boolean {
	return existsSync(join(layout.clusterData, "PG_VERSION"));
}

export function serverLog(layout: Layout): string {
	return join(layout.logs, "postgres.log");
}

export async function isRunning(
	postgresRoot: string,
	layout: Layout,
): Promise<boolean> {
	const result = await run(binary(postgresRoot, "pg_ctl"), [
		"--pgdata",
		layout.clusterData,
		"status",
	]);

	return result.code === 0;
}

export async function clearStalePidFile(
	postgresRoot: string,
	layout: Layout,
): Promise<void> {
	const pidFile = join(layout.clusterData, "postmaster.pid");
	if (!existsSync(pidFile)) return;
	if (await isRunning(postgresRoot, layout)) return;

	await rm(pidFile, { force: true });
}

export async function initialiseCluster(
	postgresRoot: string,
	layout: Layout,
	password: string,
): Promise<void> {
	await mkdir(join(layout.home, "postgres"), { recursive: true });

	const passwordFile = join(layout.home, "postgres", ".initdb-password");
	await writeFile(passwordFile, password, { mode: 0o600 });

	try {
		const result = await run(binary(postgresRoot, "initdb"), [
			"--pgdata",
			layout.clusterData,
			"--username",
			ROLE,
			"--pwfile",
			passwordFile,
			"--encoding",
			"UTF8",
			"--locale-provider",
			"builtin",
			"--builtin-locale",
			"C.UTF-8",
			"--auth-local",
			"trust",
			"--auth-host",
			"scram-sha-256",
		]);

		if (result.code !== 0) {
			throw new Error(
				`The database could not be created.\n${result.stderr || result.stdout}`,
			);
		}
	} finally {
		await rm(passwordFile, { force: true });
	}
}

const SERVER_SETTINGS = [
	"-c listen_addresses=127.0.0.1",
	"-c unix_socket_directories=",
	"-c timezone=UTC",
	"-c log_timezone=UTC",
	"-c max_connections=50",
	"-c shared_buffers=64MB",
] as const;

export async function startCluster(
	postgresRoot: string,
	layout: Layout,
	port: number,
): Promise<void> {
	await mkdir(layout.logs, { recursive: true });

	if (await isRunning(postgresRoot, layout)) return;
	await clearStalePidFile(postgresRoot, layout);

	const result = await run(binary(postgresRoot, "pg_ctl"), [
		"--pgdata",
		layout.clusterData,
		"--log",
		serverLog(layout),
		"--options",
		[`-p ${port}`, ...SERVER_SETTINGS].join(" "),
		"--wait",
		"--timeout",
		"60",
		"start",
	]);

	if (result.code !== 0) {
		const log = await readFile(serverLog(layout), "utf8").catch(() => "");
		throw new Error(
			`The database did not start.\n${result.stderr || result.stdout}\n${log.slice(-2000)}`,
		);
	}
}

export async function stopCluster(
	postgresRoot: string,
	layout: Layout,
): Promise<void> {
	await run(binary(postgresRoot, "pg_ctl"), [
		"--pgdata",
		layout.clusterData,
		"--mode",
		"fast",
		"--wait",
		"--timeout",
		"30",
		"stop",
	]);
}

export async function runningPort(layout: Layout): Promise<number | null> {
	const pidFile = join(layout.clusterData, "postmaster.pid");
	const contents = await readFile(pidFile, "utf8").catch(() => null);
	if (contents === null) return null;

	const port = Number(contents.split("\n")[3]);
	return Number.isFinite(port) && port > 0 ? port : null;
}
