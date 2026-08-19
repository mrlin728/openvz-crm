import {
	cp,
	mkdir,
	readdir,
	readFile,
	readlink,
	realpath,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { hostTarget, TARGETS, type Target, vendor } from "./vendor";

const API_EXTERNALS = [
	"pg-native",
	"@nestjs/microservices",
	"@nestjs/websockets",
	"@nestjs/graphql",
	"@fastify/*",
	"express",
];

const RUNTIME_PACKAGES = ["express"] as const;

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

async function leadsSomewhere(source: string): Promise<boolean> {
	try {
		await stat(source);
		return true;
	} catch {
		return false;
	}
}

const COPY = {
	recursive: true,
	dereference: true,
	filter: leadsSomewhere,
} as const;

async function shell(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
	const proc = Bun.spawn([command, ...args], {
		cwd: options.cwd,
		env: { ...process.env, ...options.env },
		stdout: "inherit",
		stderr: "inherit",
	});

	const code = await proc.exited;
	if (code !== 0)
		throw new Error(`${command} ${args.join(" ")} exited ${code}`);
}

async function version(repoRoot: string): Promise<string> {
	const manifest: unknown = JSON.parse(
		await readFile(join(repoRoot, "package.json"), "utf8"),
	);

	if (
		typeof manifest === "object" &&
		manifest !== null &&
		"version" in manifest &&
		typeof manifest.version === "string"
	) {
		return manifest.version;
	}

	throw new Error("The root package.json has no version.");
}

async function dependencyRange(
	manifestPath: string,
	name: string,
): Promise<string> {
	const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));

	const dependencies =
		typeof manifest === "object" &&
		manifest !== null &&
		"dependencies" in manifest
			? (manifest.dependencies as Record<string, string>)
			: {};

	const range = dependencies[name];
	if (range === undefined) {
		throw new Error(`${manifestPath} does not depend on ${name}.`);
	}

	return range;
}

async function buildApi(repoRoot: string, payload: string): Promise<void> {
	console.log("building the API");

	const api = join(repoRoot, "apps", "api");
	const externals = API_EXTERNALS.flatMap((name) => ["--external", name]);

	await shell(
		"bun",
		[
			"build",
			"src/main.ts",
			"--target=bun",
			"--outfile",
			join(payload, "server", "api.js"),
			...externals,
		],
		{ cwd: api, env: { NODE_ENV: "production" } },
	);

	const manifest = join(api, "package.json");
	const wanted = await Promise.all(
		RUNTIME_PACKAGES.map(
			async (name) => `${name}@${await dependencyRange(manifest, name)}`,
		),
	);

	console.log(`installing ${wanted.join(", ")} beside the API`);

	await shell(NPM, [
		"install",
		"--no-save",
		"--no-audit",
		"--no-fund",
		"--omit=dev",
		"--prefix",
		join(payload, "server"),
		...wanted,
	]);
}

async function buildApp(repoRoot: string, payload: string): Promise<void> {
	console.log("building the interface");

	const app = join(repoRoot, "apps", "app");

	await shell("bun", ["run", "--filter=app", "build"], {
		cwd: repoRoot,
		env: {
			DESKTOP_BUILD: "1",
			API_URL: "http://127.0.0.1:3101",
			APP_URL: "http://127.0.0.1:3100",
		},
	});

	const destination = join(payload, "server", "app");
	await rm(destination, { recursive: true, force: true });
	await cp(join(app, ".next", "standalone"), destination, COPY);

	await cp(
		join(app, ".next", "static"),
		join(destination, "apps", "app", ".next", "static"),
		COPY,
	);

	await cp(
		join(app, "public"),
		join(destination, "apps", "app", "public"),
		COPY,
	);

	const filled = await fillStubs(payload, repoRoot);
	console.log(`filled ${filled} traced packages that had only a package.json`);

	const added = await completeClosure(
		join(payload, "server", "app", "node_modules"),
		join(repoRoot, "node_modules"),
	);
	console.log(`added ${added} packages the trace never carried`);
}

async function packageDirectories(modules: string): Promise<string[]> {
	const found: string[] = [];

	for (const entry of await readdir(modules, { withFileTypes: true }).catch(
		() => [],
	)) {
		if (!entry.isDirectory()) continue;
		if (entry.name === ".bin" || entry.name === ".bun") continue;

		if (entry.name.startsWith("@")) {
			const scope = join(modules, entry.name);
			for (const inner of await readdir(scope, { withFileTypes: true }).catch(
				() => [],
			)) {
				if (inner.isDirectory()) found.push(join(entry.name, inner.name));
			}
			continue;
		}

		found.push(entry.name);
	}

	return found;
}

async function isStub(directory: string): Promise<boolean> {
	const entries: string[] = await readdir(directory).catch(() => []);
	return entries.length <= 1 && entries.includes("package.json");
}

async function dependenciesOf(manifest: string): Promise<string[]> {
	const parsed: unknown = await readFile(manifest, "utf8")
		.then((text) => JSON.parse(text))
		.catch(() => null);

	if (typeof parsed !== "object" || parsed === null) return [];

	const record = parsed as Record<string, unknown>;
	const named = record.dependencies;

	return typeof named === "object" && named !== null ? Object.keys(named) : [];
}

async function completeClosure(traced: string, real: string): Promise<number> {
	const queue = await packageDirectories(traced);
	const seen = new Set(queue);
	let copied = 0;

	while (queue.length > 0) {
		const name = queue.shift();
		if (name === undefined) continue;

		for (const dependency of await dependenciesOf(
			join(traced, name, "package.json"),
		)) {
			if (seen.has(dependency)) continue;
			seen.add(dependency);

			const destination = join(traced, dependency);
			if (await stat(destination).catch(() => null)) {
				queue.push(dependency);
				continue;
			}

			const source = join(real, dependency);
			if (!(await stat(source).catch(() => null))) continue;

			await cp(source, destination, COPY);
			copied += 1;
			queue.push(dependency);
		}
	}

	return copied;
}

async function fillStubs(payload: string, repoRoot: string): Promise<number> {
	const traced = join(payload, "server", "app", "node_modules");
	const real = join(repoRoot, "node_modules");

	let filled = 0;

	for (const name of await packageDirectories(traced)) {
		const destination = join(traced, name);
		if (!(await isStub(destination))) continue;

		const source = join(real, name);
		if (!(await stat(source).catch(() => null))) continue;

		await rm(destination, { recursive: true, force: true });
		await cp(source, destination, COPY);
		filled += 1;
	}

	return filled;
}

async function buildSupervisor(
	desktopRoot: string,
	payload: string,
): Promise<void> {
	console.log("building the supervisor");

	await shell("bun", [
		"build",
		join(desktopRoot, "runtime", "supervisor.ts"),
		"--target=bun",
		"--outfile",
		join(payload, "supervisor.js"),
	]);
}

async function copyRuntimes(
	vendored: string,
	payload: string,
	target: Target,
): Promise<void> {
	console.log("copying bun and postgres");

	const bun = target === "windows-x64" ? "bun.exe" : "bun";

	await cp(join(vendored, bun), join(payload, bun), {
		recursive: false,
		preserveTimestamps: true,
	});

	await cp(join(vendored, "postgres"), join(payload, "postgres"), {
		recursive: true,
		verbatimSymlinks: true,
	});
}

export async function escapingLinks(payload: string): Promise<string[]> {
	const glob = new Bun.Glob("**/*");
	const escaping: string[] = [];

	for await (const entry of glob.scan({
		cwd: payload,
		onlyFiles: false,
		followSymlinks: false,
	})) {
		const path = join(payload, entry);

		let target: string;
		try {
			target = await readlink(path);
		} catch {
			continue;
		}

		const resolved = isAbsolute(target)
			? target
			: resolve(join(path, ".."), target);

		const inside = await realpath(payload).catch(() => payload);
		const outside = relative(inside, resolved).startsWith("..");

		if (isAbsolute(target) || outside) escaping.push(`${entry} -> ${target}`);
	}

	return escaping;
}

export async function build(target: Target): Promise<string> {
	const desktopRoot = resolve(import.meta.dir, "..");
	const repoRoot = resolve(desktopRoot, "..", "..");

	const payload = join(desktopRoot, "payload", target);
	const vendored = await vendor(desktopRoot, target);

	await rm(payload, { recursive: true, force: true });
	await mkdir(payload, { recursive: true });

	await buildApi(repoRoot, payload);
	await buildApp(repoRoot, payload);
	await buildSupervisor(desktopRoot, payload);
	await copyRuntimes(vendored, payload, target);

	await cp(
		join(repoRoot, "packages", "db", "prisma", "migrations"),
		join(payload, "migrations"),
		{ recursive: true },
	);

	await writeFile(join(payload, "VERSION"), `${await version(repoRoot)}\n`);

	const escaping = await escapingLinks(payload);

	if (escaping.length > 0) {
		throw new Error(
			[
				`${escaping.length} links in the payload point outside it, so this build only runs on this machine:`,
				...escaping.slice(0, 10).map((line) => `  ${line}`),
				escaping.length > 10 ? `  …and ${escaping.length - 10} more` : "",
				"",
				"Next traces a workspace as symlinks into whatever node_modules layout it finds.",
				"Install with `bun install --linker=hoisted` before building the payload.",
			]
				.filter(Boolean)
				.join("\n"),
		);
	}

	return payload;
}

export async function archive(
	payload: string,
	target: Target,
): Promise<string> {
	const desktopRoot = resolve(import.meta.dir, "..");
	const distribution = join(desktopRoot, "dist");
	await mkdir(distribution, { recursive: true });

	const tarball = join(distribution, `payload-${target}.tar.gz`);
	console.log(`packing ${tarball}`);

	await shell("tar", ["-czf", tarball, "-C", payload, "."]);

	return tarball;
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

	const payload = await build(target);

	if (process.argv.includes("--archive")) {
		await archive(payload, target);
	}

	console.log(`payload ready at ${payload}`);
}
