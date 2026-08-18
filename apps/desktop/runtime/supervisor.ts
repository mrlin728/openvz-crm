import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { applyMigrations, ensureDatabase } from "./migrate";
import { crmHome, layout } from "./paths";
import { freePorts, waitUntilReachable } from "./ports";
import {
	ADMIN_DATABASE,
	clusterExists,
	connectionUrl,
	DATABASE,
	initialiseCluster,
	ROLE,
	startCluster,
	stopCluster,
} from "./postgres";
import { readOrCreateSecrets } from "./secrets";
import { readOrCreateSettings } from "./settings";

const API_TIMEOUT_MS = 90_000;
const APP_TIMEOUT_MS = 120_000;

function runtimeRoot(): string {
	return process.env.OPENVZ_CRM_RUNTIME ?? join(import.meta.dir, "..");
}

function executable(root: string, name: string): string {
	return join(root, process.platform === "win32" ? `${name}.exe` : name);
}

function report(stage: string, detail: string): void {
	process.stdout.write(`${stage} ${detail}\n`);
}

async function logStream(path: string) {
	await mkdir(dirname(path), { recursive: true });
	return createWriteStream(path, { flags: "a" });
}

async function child(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	cwd: string,
	logPath: string,
): Promise<ChildProcess> {
	const log = await logStream(logPath);

	const process_ = spawn(command, args, {
		cwd,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});

	process_.stdout.pipe(log);
	process_.stderr.pipe(log);

	return process_;
}

async function main(): Promise<void> {
	const root = runtimeRoot();
	const home = crmHome();
	const paths = layout(home);

	await mkdir(paths.logs, { recursive: true });

	const secrets = await readOrCreateSecrets(paths);
	const settings = await readOrCreateSettings(paths);
	const postgresRoot = join(root, "postgres");

	if (!clusterExists(paths)) {
		report("stage", "creating the database");
		await initialiseCluster(postgresRoot, paths, secrets.databasePassword);
	}

	const [databasePort, apiPort, appPort] = await freePorts(3);

	if (
		databasePort === undefined ||
		apiPort === undefined ||
		appPort === undefined
	) {
		throw new Error("No free ports.");
	}

	report("stage", "starting the database");
	await startCluster(postgresRoot, paths, databasePort);

	const cluster = {
		port: databasePort,
		user: ROLE,
		password: secrets.databasePassword,
		database: DATABASE,
	};

	const databaseUrl = connectionUrl(cluster);

	await ensureDatabase(
		connectionUrl({ ...cluster, database: ADMIN_DATABASE }),
		DATABASE,
	);

	report("stage", "updating the database");
	const migrations = await applyMigrations(
		databaseUrl,
		join(root, "migrations"),
	);
	report("migrations", `${migrations.applied.length} applied`);

	const apiUrl = `http://127.0.0.1:${apiPort}`;
	const appUrl = `http://127.0.0.1:${appPort}`;

	const shared: NodeJS.ProcessEnv = {
		...process.env,
		...settings,
		DATABASE_URL: databaseUrl,
		DIRECT_DATABASE_URL: databaseUrl,
		BETTER_AUTH_SECRET: secrets.authSecret,
		AUTH_LOCAL_ACCOUNTS: "1",
		API_URL: apiUrl,
		APP_URL: appUrl,
		OPENVZ_CRM_HOME: home,
	};

	const bun = executable(root, "bun");

	report("stage", "starting the server");
	const api = await child(
		bun,
		[join(root, "server", "api.js")],
		{ ...shared, PORT: String(apiPort) },
		join(root, "server"),
		join(paths.logs, "api.log"),
	);

	await waitUntilReachable(`${apiUrl}/api/auth/ok`, API_TIMEOUT_MS, "The API");

	report("stage", "starting the interface");
	const appRoot = join(root, "server", "app", "apps", "app");

	const app = await child(
		bun,
		[join(appRoot, "server.js")],
		{
			...shared,
			PORT: String(appPort),
			HOSTNAME: "127.0.0.1",
			NODE_ENV: "production",
		},
		appRoot,
		join(paths.logs, "app.log"),
	);

	await waitUntilReachable(`${appUrl}/sign-in`, APP_TIMEOUT_MS, "The app");

	await writeFile(
		paths.state,
		JSON.stringify({ appUrl, apiUrl, databasePort }, null, "\t"),
	);

	report("ready", appUrl);

	let closing = false;

	const shutdown = async (code: number) => {
		if (closing) return;
		closing = true;

		app.kill("SIGTERM");
		api.kill("SIGTERM");
		await stopCluster(postgresRoot, paths);
		process.exit(code);
	};

	for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
		process.on(signal, () => {
			void shutdown(0);
		});
	}

	for (const [name, process_] of [
		["api", api],
		["app", app],
	] as const) {
		process_.on("exit", (code) => {
			if (closing) return;
			report("failed", `the ${name} stopped with code ${code}`);
			void shutdown(1);
		});
	}
}

await main().catch((error: unknown) => {
	report("failed", error instanceof Error ? error.message : String(error));
	process.exit(1);
});
