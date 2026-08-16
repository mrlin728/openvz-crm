import { describe, expect, it } from "bun:test";
import { namesMatch } from "../agent/lib/names";
import { extractSocialUrls, parseSocialUrl } from "../agent/lib/socials";

describe("parseSocialUrl", () => {
	it("reads a profile on either X hostname", () => {
		expect(parseSocialUrl("https://x.com/adrianfenwick")).toEqual({
			network: "x",
			handle: "adrianfenwick",
			url: "https://x.com/adrianfenwick",
		});
		expect(parseSocialUrl("https://twitter.com/AdrianFenwick")?.url).toBe(
			"https://x.com/AdrianFenwick",
		);
		expect(parseSocialUrl("https://mobile.twitter.com/@adrian")?.handle).toBe(
			"adrian",
		);
	});

	it("refuses a deep link, which is where most wrong handles come from", () => {
		expect(parseSocialUrl("https://x.com/someone/status/1234")).toBeNull();
		expect(parseSocialUrl("https://github.com/someone/some-repo")).toBeNull();
	});

	it("refuses site paths that parse like a username", () => {
		expect(parseSocialUrl("https://github.com/pricing")).toBeNull();
		expect(parseSocialUrl("https://github.com/orgs")).toBeNull();
		expect(parseSocialUrl("https://x.com/settings")).toBeNull();
		expect(parseSocialUrl("https://x.com/i")).toBeNull();
	});

	it("refuses handles neither network could issue", () => {
		expect(parseSocialUrl("https://x.com/waytoolongforanxhandle")).toBeNull();
		expect(parseSocialUrl("https://github.com/-adrian")).toBeNull();
		expect(parseSocialUrl("https://github.com/adrian--fenwick")).toBeNull();
	});

	it("ignores anything that is not one of the two networks", () => {
		expect(parseSocialUrl("https://linkedin.com/in/adrianfenwick")).toBeNull();
		expect(parseSocialUrl("not a url")).toBeNull();
		expect(parseSocialUrl("")).toBeNull();
	});
});

describe("extractSocialUrls", () => {
	it("pulls profiles out of prose and citations, deduplicated", () => {
		const found = extractSocialUrls([
			"You can find him at https://github.com/adrianfenwick and https://x.com/adrianfenwick.",
			"https://github.com/adrianfenwick",
			"https://github.com/adrianfenwick/crm",
		]);

		expect(found.map((f) => f.url)).toEqual([
			"https://github.com/adrianfenwick",
			"https://x.com/adrianfenwick",
		]);
	});

	it("finds nothing in an answer that cites nothing", () => {
		expect(extractSocialUrls(["I could not find a GitHub profile."])).toEqual(
			[],
		);
	});
});

describe("namesMatch", () => {
	it("accepts the same person written two ways", () => {
		expect(namesMatch("Adrian Fenwick", "Adrian Fenwick")).toBe(true);
		expect(namesMatch("Adrian J. Fenwick", "Adrian Fenwick")).toBe(true);
		expect(namesMatch("adrian fenwick", "Adrian Fenwick")).toBe(true);
	});

	it("rejects a near miss", () => {
		expect(namesMatch("Adrian Fenton", "Adrian Fenwick")).toBe(false);
		expect(namesMatch("Adrien Fenwick", "Adrian Fenwick")).toBe(false);
	});

	it("rejects a first name on its own", () => {
		expect(namesMatch("Adrian", "Adrian Fenwick")).toBe(false);
		expect(namesMatch(null, "Adrian Fenwick")).toBe(false);
	});
});
