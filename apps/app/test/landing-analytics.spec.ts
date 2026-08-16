import { describe, expect, it } from "bun:test";
import { analyticsAllowed } from "../lib/analytics";

describe("analyticsAllowed", () => {
	it("allows the host the landing page is served from", () => {
		expect(analyticsAllowed("crm.openvzai.com")).toBe(true);
	});

	it("refuses the marketing site, which serves its own /crm page", () => {
		expect(analyticsAllowed("www.openvzai.com")).toBe(false);
	});

	it("ignores case and surrounding whitespace", () => {
		expect(analyticsAllowed(" CRM.OpenVZAI.com ")).toBe(true);
	});

	it("refuses a self-hosted install serving the same page", () => {
		expect(analyticsAllowed("crm.acme.com")).toBe(false);
		expect(analyticsAllowed("localhost")).toBe(false);
	});

	it("refuses a preview deployment", () => {
		expect(analyticsAllowed("crm-git-preview-telemetry.vercel.app")).toBe(
			false,
		);
	});

	it("refuses a host that merely ends in the marketing domain", () => {
		expect(analyticsAllowed("evil-openvzai.com")).toBe(false);
		expect(analyticsAllowed("openvzai.com.attacker.com")).toBe(false);
	});
});
