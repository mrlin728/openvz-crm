import { copyFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { archive, build } from "./payload";
import { hostTarget, TARGETS, type Target } from "./vendor";

async function shell(
	command: string,
	args: string[],
	cwd: string,
): Promise<void> {
	const proc = Bun.spawn([command, ...args], {
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});

	const code = await proc.exited;
	if (code !== 0)
		throw new Error(`${command} ${args.join(" ")} exited ${code}`);
}

if (import.meta.main) {
	const desktopRoot = resolve(import.meta.dir, "..");

	const requested = process.argv
		.slice(2)
		.find((argument) => !argument.startsWith("-"));

	const target = (requested ?? hostTarget()) as Target;

	if (!(target in TARGETS)) {
		console.error(
			`Unknown target "${target}". Known: ${Object.keys(TARGETS).join(", ")}`,
		);
		process.exit(1);
	}

	if (target !== hostTarget()) {
		console.error(
			`This machine is ${hostTarget()}. An installer has to be built on the system it is for: the Next.js build traces a native image library for the platform it runs on, and neither dmg nor NSIS can be produced from the other side.`,
		);
		process.exit(1);
	}

	const payload = await build(target);
	const tarball = await archive(payload, target);

	const resource = join(desktopRoot, "src-tauri", "payload.tar.gz");
	await rm(resource, { force: true });
	await copyFile(tarball, resource);

	await shell("bunx", ["tauri", "build"], desktopRoot);

	console.log("installer written to src-tauri/target/release/bundle");
}
