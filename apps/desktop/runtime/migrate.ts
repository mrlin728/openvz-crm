import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SQL } from "bun";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
	"id" VARCHAR(36) PRIMARY KEY NOT NULL,
	"checksum" VARCHAR(64) NOT NULL,
	"finished_at" TIMESTAMPTZ,
	"migration_name" VARCHAR(255) NOT NULL,
	"logs" TEXT,
	"rolled_back_at" TIMESTAMPTZ,
	"started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

export interface Migration {
	name: string;
	sql: string;
	checksum: string;
}

export async function readMigrations(directory: string): Promise<Migration[]> {
	const entries = await readdir(directory, { withFileTypes: true });

	const names = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const migrations: Migration[] = [];

	for (const name of names) {
		const sql = await readFile(
			join(directory, name, "migration.sql"),
			"utf8",
		).catch(() => null);
		if (sql === null) continue;

		migrations.push({
			name,
			sql,
			checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
		});
	}

	return migrations;
}

const CONNECT_TIMEOUT_MS = 30_000;
const CONNECT_ATTEMPTS = 10;

export async function connect(
	url: string,
	label: string,
	log: (message: string) => void = () => {},
): Promise<SQL> {
	let last: unknown;

	for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
		const sql = new SQL(url);

		try {
			await Promise.race([
				sql`SELECT 1`,
				Bun.sleep(CONNECT_TIMEOUT_MS).then(() => {
					throw new Error(`no answer in ${CONNECT_TIMEOUT_MS}ms`);
				}),
			]);

			return sql;
		} catch (error) {
			last = error;
			await sql.end().catch(() => {});
			log(`${label}: attempt ${attempt} failed (${describe(error)})`);
			await Bun.sleep(1000);
		}
	}

	throw new Error(
		`Could not reach the database to ${label}: ${describe(last)}`,
	);
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function ensureDatabase(
	adminUrl: string,
	database: string,
	log: (message: string) => void = () => {},
): Promise<void> {
	const sql = await connect(adminUrl, "create the database", log);

	try {
		const existing = await sql`
			SELECT 1 FROM pg_database WHERE datname = ${database}
		`;

		if (existing.length === 0) {
			await sql.unsafe(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
		}
	} finally {
		await sql.end();
	}
}

export function managesItsOwnTransaction(sql: string): boolean {
	return /^[ \t]*BEGIN[ \t]*;/im.test(sql);
}

type Recorder = (
	strings: TemplateStringsArray,
	...values: unknown[]
) => Promise<unknown>;

async function record(sql: Recorder, migration: Migration): Promise<void> {
	await sql`
		INSERT INTO "_prisma_migrations" (
			"id", "checksum", "migration_name", "started_at",
			"finished_at", "applied_steps_count"
		) VALUES (
			${crypto.randomUUID()}, ${migration.checksum}, ${migration.name},
			now(), now(), 1
		)
	`;
}

export interface MigrationReport {
	applied: string[];
	alreadyApplied: number;
}

export async function applyMigrations(
	url: string,
	directory: string,
	report: (migration: string) => void = () => {},
): Promise<MigrationReport> {
	const migrations = await readMigrations(directory);
	const sql = await connect(url, "apply the migrations", report);
	const applied: string[] = [];

	try {
		await sql.unsafe(MIGRATIONS_TABLE);

		const rows = (await sql`
			SELECT "migration_name" FROM "_prisma_migrations"
			WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
		`) as { migration_name: string }[];

		const done = new Set(rows.map((row) => row.migration_name));

		for (const migration of migrations) {
			if (done.has(migration.name)) continue;

			report(migration.name);

			if (managesItsOwnTransaction(migration.sql)) {
				await sql.unsafe(migration.sql);
				await record(sql, migration);
			} else {
				await sql.begin(async (tx) => {
					await tx.unsafe(migration.sql);
					await record(tx, migration);
				});
			}

			applied.push(migration.name);
		}

		return { applied, alreadyApplied: migrations.length - applied.length };
	} finally {
		await sql.end();
	}
}
