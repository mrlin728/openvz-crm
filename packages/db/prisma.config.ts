import "@openvz/env/load";

import path from "node:path";
import { defineConfig, env } from "prisma/config";

const MIGRATION_URL = [
	"DIRECT_DATABASE_URL",
	"POSTGRES_URL_NON_POOLING",
	"DATABASE_URL",
].find((name) => process.env[name]?.trim());

export default defineConfig({
	schema: path.join("prisma", "schema.prisma"),
	migrations: {
		path: path.join("prisma", "migrations"),
		seed: "bun run prisma/seed.ts",
	},
	datasource: {
		url: env(MIGRATION_URL ?? "DATABASE_URL"),
	},
});
