import { afterAll } from "bun:test";

afterAll(async () => {
	if (!process.env.DATABASE_URL) return;
	const { db } = await import("@openvz/db");
	await db.$disconnect();
});
