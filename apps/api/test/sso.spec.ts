import { afterEach, describe, expect, it } from "bun:test";
import { ForbiddenException } from "@nestjs/common";
import { isGoogleConfigured, WORKSPACE_ID } from "@openvz/auth";
import type { Db } from "@openvz/db";
import { SsoService } from "../src/sso/sso.service";

type Row = {
	providerId: string;
	issuer: string;
	domain: string;
	oidcConfig: string | null;
	samlConfig: string | null;
};

const localAccounts = process.env.AUTH_LOCAL_ACCOUNTS;

afterEach(() => {
	if (localAccounts === undefined) {
		delete process.env.AUTH_LOCAL_ACCOUNTS;
		return;
	}

	process.env.AUTH_LOCAL_ACCOUNTS = localAccounts;
});

const LIST = {
	q: "",
	sort: "providerId",
	dir: "asc" as const,
	page: 1,
	pageSize: 25,
};

function service(role: string | null, rows: Row[] = [], users = 1) {
	const seen: { providerWhere?: unknown } = {};

	const db = {
		member: {
			findUnique: async () => (role === null ? null : { role }),
		},
		ssoProvider: {
			findMany: async ({ where }: { where: unknown }) => {
				seen.providerWhere = where;
				return rows;
			},
			count: async () => rows.length,
		},
		user: {
			count: async () => users,
		},
	} as unknown as Db;

	return { sso: new SsoService(db), seen };
}

const OKTA: Row = {
	providerId: "okta",
	issuer: "https://acme.okta.com",
	domain: "acme.com, subsidiary.com",
	oidcConfig: JSON.stringify({
		clientId: "0oa1b2c3d4WXYZ",
		clientSecret: "shhh",
	}),
	samlConfig: null,
};

describe("who may configure SSO", () => {
	it("lets an owner and an admin", async () => {
		for (const role of ["owner", "admin"]) {
			const { sso } = service(role);
			expect((await sso.settings("u1")).canConfigure).toBe(true);
		}
	});

	it("refuses a member, and refuses them the writes too", async () => {
		const { sso } = service("member");

		expect((await sso.settings("u1")).canConfigure).toBe(false);

		expect(
			sso.remove("u1", new Headers(), { providerId: "okta" }),
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(
			sso.register("u1", new Headers(), {
				providerId: "okta",
				issuer: "https://acme.okta.com",
				domain: "acme.com",
				clientId: "id",
				clientSecret: "secret",
			}),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("refuses somebody who is not in the workspace at all", async () => {
		const { sso } = service(null);
		expect((await sso.settings("u1")).canConfigure).toBe(false);
	});
});

describe("what a provider looks like once it is saved", () => {
	it("never hands back the client secret", async () => {
		const { sso } = service("owner", [OKTA]);
		const [provider] = (await sso.list(LIST)).rows;

		expect(JSON.stringify(provider)).not.toContain("shhh");
		expect(provider?.clientIdLastFour).toBe("WXYZ");
	});

	it("splits the domains and names the callback the IdP needs", async () => {
		const { sso } = service("owner", [OKTA]);
		const [provider] = (await sso.list(LIST)).rows;

		expect(provider?.domains).toEqual(["acme.com", "subsidiary.com"]);
		expect(provider?.type).toBe("oidc");
		expect(provider?.name).toBe("Okta");
		expect(provider?.callbackURL).toEndWith("/api/auth/sso/callback/okta");
	});

	it("reads only the one workspace, never an organization it was passed", async () => {
		const { sso, seen } = service("owner", [OKTA]);
		await sso.list(LIST);

		expect(seen.providerWhere).toEqual({ organizationId: WORKSPACE_ID });
	});

	it("searches the name, the domain and the issuer", async () => {
		const { sso, seen } = service("owner", [OKTA]);
		await sso.list({ ...LIST, q: " acme " });

		expect(seen.providerWhere).toEqual({
			organizationId: WORKSPACE_ID,
			OR: [
				{ providerId: { contains: "acme", mode: "insensitive" } },
				{ domain: { contains: "acme", mode: "insensitive" } },
				{ issuer: { contains: "acme", mode: "insensitive" } },
			],
		});
	});
});

describe("the sign-in page's read", () => {
	it("carries the name and nothing else", async () => {
		const { sso } = service(null, [OKTA]);

		expect((await sso.signInOptions()).providers).toEqual([
			{ providerId: "okta", name: "Okta" },
		]);
	});

	it("says whether Google is configured, so the page can offer nothing", async () => {
		const { sso } = service(null, [OKTA]);

		expect((await sso.signInOptions()).google).toBe(isGoogleConfigured());
	});

	it("offers no password form on a hosted install", async () => {
		delete process.env.AUTH_LOCAL_ACCOUNTS;
		const { sso } = service(null, [], 0);

		const options = await sso.signInOptions();

		expect(options.password).toBe(false);
		expect(options.firstRun).toBe(false);
	});

	it("asks the first person on an installed copy to make an account", async () => {
		process.env.AUTH_LOCAL_ACCOUNTS = "1";
		const { sso } = service(null, [], 0);

		const options = await sso.signInOptions();

		expect(options.password).toBe(true);
		expect(options.firstRun).toBe(true);
	});

	it("asks everybody after them to sign in", async () => {
		process.env.AUTH_LOCAL_ACCOUNTS = "1";
		const { sso } = service(null, [], 1);

		const options = await sso.signInOptions();

		expect(options.password).toBe(true);
		expect(options.firstRun).toBe(false);
	});
});
