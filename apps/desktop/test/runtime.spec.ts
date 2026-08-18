import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { managesItsOwnTransaction, readMigrations } from "../runtime/migrate";
import { crmHome, layout } from "../runtime/paths";
import { freePorts } from "../runtime/ports";
import { connectionUrl } from "../runtime/postgres";
import { readOrCreateSecrets } from "../runtime/secrets";
import { readOrCreateSettings } from "../runtime/settings";

const MIGRATIONS = resolve(
	import.meta.dir,
	"..",
	"..",
	"..",
	"packages",
	"db",
	"prisma",
	"migrations",
);

async function scratch(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "openvz-crm-desktop-"));
}

describe("where an install keeps its things", () => {
	test("OPENVZ_CRM_HOME wins, and everything hangs off it", () => {
		const previous = process.env.OPENVZ_CRM_HOME;
		process.env.OPENVZ_CRM_HOME = "/tmp/somewhere-else";

		try {
			expect(crmHome()).toBe("/tmp/somewhere-else");

			const paths = layout();
			for (const path of [
				paths.clusterData,
				paths.runtime,
				paths.logs,
				paths.secrets,
				paths.state,
			]) {
				expect(path.startsWith("/tmp/somewhere-else")).toBe(true);
			}
		} finally {
			if (previous === undefined) delete process.env.OPENVZ_CRM_HOME;
			else process.env.OPENVZ_CRM_HOME = previous;
		}
	});
});

describe("the connection string", () => {
	const cluster = {
		port: 5599,
		user: "openvz",
		password: "pa/ss:wo rd?&#",
		database: "openvz_crm",
	};

	test("carries no ?schema, which the server would read as a setting", () => {
		expect(connectionUrl(cluster)).not.toContain("schema");
	});

	test("survives a generated password with reserved characters", () => {
		const url = new URL(connectionUrl(cluster));

		expect(decodeURIComponent(url.password)).toBe(cluster.password);
		expect(url.hostname).toBe("127.0.0.1");
		expect(url.port).toBe("5599");
		expect(url.pathname).toBe("/openvz_crm");
	});
});

describe("reading the migrations", () => {
	test("orders them by name and checksums the file", async () => {
		const directory = await scratch();

		for (const name of ["20260102000000_second", "20260101000000_first"]) {
			await mkdir(join(directory, name), { recursive: true });
			await writeFile(join(directory, name, "migration.sql"), `-- ${name}\n`);
		}

		await mkdir(join(directory, "20260103000000_empty"), { recursive: true });

		const migrations = await readMigrations(directory);

		expect(migrations.map((migration) => migration.name)).toEqual([
			"20260101000000_first",
			"20260102000000_second",
		]);

		const first = migrations[0];
		expect(first).toBeDefined();
		expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
	});

	test("every migration in this repo can be read", async () => {
		const migrations = await readMigrations(MIGRATIONS);

		expect(migrations.length).toBeGreaterThan(40);
		expect(new Set(migrations.map((m) => m.name)).size).toBe(migrations.length);
	});
});

describe("migrations that open their own transaction", () => {
	test("are recognised", () => {
		expect(managesItsOwnTransaction("BEGIN;\nALTER TABLE x ADD y int;\n")).toBe(
			true,
		);
		expect(managesItsOwnTransaction("  begin ;\nSELECT 1;\n")).toBe(true);
	});

	test("ordinary DDL is not mistaken for one", () => {
		expect(managesItsOwnTransaction('CREATE TABLE "a" ("id" text);')).toBe(
			false,
		);
		expect(managesItsOwnTransaction("-- BEGIN; the old way\nSELECT 1;")).toBe(
			false,
		);
	});

	test("the one in this repo is found", async () => {
		const migrations = await readMigrations(MIGRATIONS);
		const own = migrations.filter((migration) =>
			managesItsOwnTransaction(migration.sql),
		);

		expect(own.map((migration) => migration.name)).toContain(
			"20260731210000_forward_only_sync",
		);
	});
});

describe("ports", () => {
	test("hands back as many distinct ports as asked for", async () => {
		const ports = await freePorts(3);

		expect(ports).toHaveLength(3);
		expect(new Set(ports).size).toBe(3);
		for (const port of ports) expect(port).toBeGreaterThan(1024);
	});
});

describe("secrets", () => {
	test("are generated once and then reused", async () => {
		const home = await scratch();
		const paths = layout(home);

		const first = await readOrCreateSecrets(paths);
		const second = await readOrCreateSecrets(paths);

		expect(second).toEqual(first);
		expect(first.authSecret.length).toBeGreaterThanOrEqual(32);
		expect(first.databasePassword.length).toBeGreaterThan(0);
	});

	test("are not readable by anybody else", async () => {
		const home = await scratch();
		const paths = layout(home);

		await readOrCreateSecrets(paths);
		const info = await stat(paths.secrets);

		expect(info.mode & 0o077).toBe(0);
	});

	test("a damaged file stops the install rather than silently resetting it", async () => {
		const home = await scratch();
		const paths = layout(home);

		await mkdir(home, { recursive: true });
		await writeFile(paths.secrets, '{"databasePassword":""}');

		expect(readOrCreateSecrets(paths)).rejects.toThrow();

		expect(await readFile(paths.secrets, "utf8")).toBe(
			'{"databasePassword":""}',
		);
	});
});

describe("settings.env", () => {
	test("is created with a template a person can read", async () => {
		const home = await scratch();
		const paths = layout(home);

		expect(await readOrCreateSettings(paths)).toEqual({});

		const template = await readFile(paths.settings, "utf8");
		expect(template).toContain("ALLOWED_SIGN_IN");
		expect(
			template.split("\n").every((line) => line === "" || line.startsWith("#")),
		).toBe(true);
	});

	test("hands back what somebody put in it", async () => {
		const home = await scratch();
		const paths = layout(home);

		await mkdir(home, { recursive: true });
		await writeFile(
			paths.settings,
			'# a note\nALLOWED_SIGN_IN="colleague@example.com"\nGOOGLE_CLIENT_ID=abc\n',
		);

		expect(await readOrCreateSettings(paths)).toEqual({
			ALLOWED_SIGN_IN: "colleague@example.com",
			GOOGLE_CLIENT_ID: "abc",
		});
	});

	test("cannot take over what the supervisor decides", async () => {
		const home = await scratch();
		const paths = layout(home);

		await mkdir(home, { recursive: true });
		await writeFile(
			paths.settings,
			"DATABASE_URL=postgresql://elsewhere\nBETTER_AUTH_SECRET=guessable\nAPI_URL=http://evil\nALLOWED_SIGN_IN=acme.com\n",
		);

		expect(await readOrCreateSettings(paths)).toEqual({
			ALLOWED_SIGN_IN: "acme.com",
		});
	});
});
