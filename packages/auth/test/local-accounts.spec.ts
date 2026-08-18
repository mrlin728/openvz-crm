import { afterEach, describe, expect, it } from "bun:test";
import { isLocalAccountsEnabled } from "../src/env";

const original = process.env.AUTH_LOCAL_ACCOUNTS;

afterEach(() => {
	if (original === undefined) {
		delete process.env.AUTH_LOCAL_ACCOUNTS;
		return;
	}

	process.env.AUTH_LOCAL_ACCOUNTS = original;
});

describe("local accounts", () => {
	it("is off when nothing asks for it", () => {
		delete process.env.AUTH_LOCAL_ACCOUNTS;

		expect(isLocalAccountsEnabled()).toBe(false);
	});

	it("accepts 1 and true, in any case", () => {
		for (const value of ["1", "true", "TRUE", "True"]) {
			process.env.AUTH_LOCAL_ACCOUNTS = value;

			expect(isLocalAccountsEnabled()).toBe(true);
		}
	});

	it("refuses anything else, so a typo fails closed", () => {
		for (const value of ["", "0", "false", "yes", "on"]) {
			process.env.AUTH_LOCAL_ACCOUNTS = value;

			expect(isLocalAccountsEnabled()).toBe(false);
		}
	});

	it("is read on every call, so a process never caches a stale answer", () => {
		delete process.env.AUTH_LOCAL_ACCOUNTS;
		expect(isLocalAccountsEnabled()).toBe(false);

		process.env.AUTH_LOCAL_ACCOUNTS = "1";
		expect(isLocalAccountsEnabled()).toBe(true);
	});
});
