import { beforeEach, describe, expect, it } from "bun:test";
import { isWorkspaceEmail } from "@openvz/auth/workspace";
import { externalParticipants } from "../src/mailbox/participants";

beforeEach(() => {
	process.env.ALLOWED_SIGN_IN = "acme.com";
});

describe("isWorkspaceEmail", () => {
	it("admits our people", () => {
		for (const email of [
			"adrian@acme.com",
			"LEWIS@Acme.com",
			"  adrian@acme.com  ",
			"someone@mail.acme.com",
		]) {
			expect(isWorkspaceEmail(email)).toBe(true);
		}
	});

	it("refuses everybody else", () => {
		for (const email of [
			"adrian@gmail.com",
			"stranger@example.com",
			"",
			null,
			undefined,
		]) {
			expect(isWorkspaceEmail(email)).toBe(false);
		}
	});

	it("is not fooled by a lookalike domain", () => {
		for (const email of [
			"a@acme.com.evil.com",
			"a@notacme.com",
			"a@acme.community",
			"a@evil.com?@acme.com".replace("?", ""),
		]) {
			expect(isWorkspaceEmail(email)).toBe(false);
		}
	});

	it("fails closed when nothing is allowed", () => {
		process.env.ALLOWED_SIGN_IN = "";
		expect(isWorkspaceEmail("adrian@acme.com")).toBe(false);
	});

	it("admits a single address, for a one-person install", () => {
		process.env.ALLOWED_SIGN_IN = "adrian@gmail.com";

		expect(isWorkspaceEmail("adrian@gmail.com")).toBe(true);
		expect(isWorkspaceEmail("someone.else@gmail.com")).toBe(false);
	});

	it("mixes a domain with individual outsiders", () => {
		process.env.ALLOWED_SIGN_IN = "acme.com, contractor@gmail.com";

		expect(isWorkspaceEmail("adrian@acme.com")).toBe(true);
		expect(isWorkspaceEmail("contractor@gmail.com")).toBe(true);
		expect(isWorkspaceEmail("stranger@gmail.com")).toBe(false);
	});
});

describe("internal addresses never become leads", () => {
	const options = {
		ourDomains: new Set(["acme.com"]),
		ourAddresses: new Set<string>(),
		suppressedDomains: new Set<string>(),
		suppressedEmails: new Set<string>(),
	};

	it("drops colleagues even when they are not users", () => {
		const result = externalParticipants(
			[
				{ email: "adrian@acme.com", name: "Lewis" },
				{ email: "newstarter@acme.com", name: "New Starter" },
				{ email: "jane@globex.com", name: "Jane" },
			],
			options,
		);

		expect(result.map((person) => person.email)).toEqual(["jane@globex.com"]);
	});

	it("stores nothing for a wholly internal thread", () => {
		expect(
			externalParticipants(
				[
					{ email: "adrian@acme.com", name: null },
					{ email: "colleague@acme.com", name: null },
				],
				options,
			),
		).toEqual([]);
	});
});
