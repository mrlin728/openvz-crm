import { existsSync } from "node:fs";
import { chmod, mkdir, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";

const BUN_VERSION = "1.3.14";
const POSTGRES_VERSION = "18.4.0-beta.17";

export const TARGETS = {
	"darwin-arm64": {
		bunAsset: "bun-darwin-aarch64",
		postgresPackage: "darwin-arm64",
		machOArch: "arm64",
	},
	"darwin-x64": {
		bunAsset: "bun-darwin-x64",
		postgresPackage: "darwin-x64",
		machOArch: "x86_64",
	},
	"windows-x64": {
		bunAsset: "bun-windows-x64",
		postgresPackage: "windows-x64",
		machOArch: null,
	},
	"linux-x64": {
		bunAsset: "bun-linux-x64",
		postgresPackage: "linux-x64",
		machOArch: null,
	},
} as const;

export type Target = keyof typeof TARGETS;

export function hostTarget(): Target {
	const { platform, arch } = process;
	if (platform === "darwin")
		return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (platform === "win32") return "windows-x64";
	return "linux-x64";
}

export function vendorDirectory(root: string, target: Target): string {
	return join(root, "vendor", target);
}

async function shell(
	command: string,
	args: string[],
	cwd?: string,
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

async function unzip(archive: string, destination: string): Promise<void> {
	if (process.platform === "win32") {
		await shell("powershell", [
			"-NoProfile",
			"-Command",
			`Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destination}' -Force`,
		]);
		return;
	}

	await shell("unzip", ["-q", archive, "-d", destination]);
}

async function download(url: string, destination: string): Promise<void> {
	await shell("curl", ["-fL", "-sS", "--retry", "3", "-o", destination, url]);
}

async function hydrateSymlinks(postgresRoot: string): Promise<number> {
	const manifest = join(postgresRoot, "pg-symlinks.json");
	if (!existsSync(manifest)) return 0;

	const links = (await Bun.file(manifest).json()) as {
		source: string;
		target: string;
	}[];

	let made = 0;

	for (const link of links) {
		const source = link.source.replace(/^native\//, "");
		const target = link.target.replace(/^native\//, "");
		const path = join(postgresRoot, target);

		await rm(path, { force: true });
		await symlink(source.split("/").pop() ?? source, path);
		made += 1;
	}

	return made;
}

async function thinMachO(postgresRoot: string, arch: string): Promise<void> {
	const lipo = Bun.which("lipo");
	if (!lipo) {
		console.log("  lipo not available — leaving the universal binaries alone");
		return;
	}

	const glob = new Bun.Glob("{bin,lib}/**/*");
	let thinned = 0;

	for await (const relative of glob.scan({
		cwd: postgresRoot,
		onlyFiles: true,
		followSymlinks: false,
	})) {
		const path = join(postgresRoot, relative);
		const info = Bun.spawnSync([lipo, "-archs", path], { stderr: "ignore" });
		if (info.exitCode !== 0) continue;

		const archs = info.stdout.toString().trim().split(/\s+/);
		if (archs.length < 2 || !archs.includes(arch)) continue;

		const temporary = `${path}.thin`;
		await shell(lipo, ["-thin", arch, path, "-output", temporary]);
		await rename(temporary, path);
		await chmod(path, 0o755);
		thinned += 1;
	}

	console.log(`  thinned ${thinned} binaries to ${arch}`);
}

async function vendorPostgres(
	directory: string,
	target: Target,
): Promise<void> {
	const { postgresPackage, machOArch } = TARGETS[target];
	const postgresRoot = join(directory, "postgres");

	if (existsSync(join(postgresRoot, "bin"))) {
		console.log("  postgres: already vendored");
		return;
	}

	const name = `@embedded-postgres/${postgresPackage}`;
	const url = `https://registry.npmjs.org/${name.replace("/", "%2f")}/-/${postgresPackage}-${POSTGRES_VERSION}.tgz`;

	console.log(`  postgres: downloading ${name}@${POSTGRES_VERSION}`);
	const staging = join(directory, ".staging-postgres");
	await rm(staging, { recursive: true, force: true });
	await mkdir(staging, { recursive: true });

	const tarball = join(staging, "postgres.tgz");
	await download(url, tarball);
	await shell("tar", ["-xzf", tarball, "-C", staging]);

	await mkdir(postgresRoot, { recursive: true });
	await rename(join(staging, "package", "native"), postgresRoot);
	await rm(staging, { recursive: true, force: true });

	const links = await hydrateSymlinks(postgresRoot);
	console.log(`  postgres: restored ${links} symlinks`);

	if (machOArch && process.platform === "darwin") {
		await thinMachO(postgresRoot, machOArch);
	}

	if (process.platform !== "win32") {
		const glob = new Bun.Glob("bin/*");
		for await (const relative of glob.scan({
			cwd: postgresRoot,
			onlyFiles: true,
		})) {
			await chmod(join(postgresRoot, relative), 0o755);
		}
	}
}

async function vendorBun(directory: string, target: Target): Promise<void> {
	const { bunAsset } = TARGETS[target];
	const executable = target === "windows-x64" ? "bun.exe" : "bun";
	const destination = join(directory, executable);

	if (existsSync(destination)) {
		console.log("  bun: already vendored");
		return;
	}

	const url = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${bunAsset}.zip`;
	console.log(`  bun: downloading ${BUN_VERSION} (${bunAsset})`);

	const staging = join(directory, ".staging-bun");
	await rm(staging, { recursive: true, force: true });
	await mkdir(staging, { recursive: true });

	const archive = join(staging, "bun.zip");
	await download(url, archive);
	await unzip(archive, staging);

	await rename(join(staging, bunAsset, executable), destination);
	await rm(staging, { recursive: true, force: true });
	if (process.platform !== "win32") await chmod(destination, 0o755);
}

export async function vendor(root: string, target: Target): Promise<string> {
	const directory = vendorDirectory(root, target);
	await mkdir(directory, { recursive: true });

	console.log(`vendoring for ${target} → ${directory}`);
	await vendorBun(directory, target);
	await vendorPostgres(directory, target);

	return directory;
}

if (import.meta.main) {
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

	await vendor(resolve(import.meta.dir, ".."), target);
	console.log("done");
}
