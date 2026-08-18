import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Layout } from "./paths";

export interface Secrets {
	databasePassword: string;
	authSecret: string;
}

function generate(bytes: number): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString(
		"base64url",
	);
}

function isSecrets(value: unknown): value is Secrets {
	if (typeof value !== "object" || value === null) return false;

	const record = value as Record<string, unknown>;

	return (
		typeof record.databasePassword === "string" &&
		record.databasePassword.length > 0 &&
		typeof record.authSecret === "string" &&
		record.authSecret.length >= 32
	);
}

export async function readOrCreateSecrets(layout: Layout): Promise<Secrets> {
	const existing = await readFile(layout.secrets, "utf8").catch(() => null);

	if (existing !== null) {
		const parsed: unknown = JSON.parse(existing);
		if (isSecrets(parsed)) return parsed;

		throw new Error(
			`${layout.secrets} is not readable. Move it aside to start over, but the database will not open without its password.`,
		);
	}

	const secrets: Secrets = {
		databasePassword: generate(24),
		authSecret: generate(32),
	};

	await mkdir(dirname(layout.secrets), { recursive: true });
	await writeFile(layout.secrets, JSON.stringify(secrets, null, "\t"), {
		mode: 0o600,
	});

	return secrets;
}
