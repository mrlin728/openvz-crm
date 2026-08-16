import { describe, expect, it } from "bun:test";
import {
	DISABLE_VARIABLES,
	ENABLE_VARIABLE,
	telemetryDisabled,
} from "../src/disabled";

describe("telemetryDisabled", () => {
	it("sends nothing until an operator opts in", () => {
		expect(telemetryDisabled({})).toBe(true);
	});

	it("is on once OPENVZ_TELEMETRY_ENABLED is set", () => {
		expect(telemetryDisabled({ [ENABLE_VARIABLE]: "1" })).toBe(false);
	});

	it("lets an opt-out beat an opt-in", () => {
		expect(
			telemetryDisabled({ [ENABLE_VARIABLE]: "1", DO_NOT_TRACK: "1" }),
		).toBe(true);
	});

	it("sends nothing from a test run, whatever else is set", () => {
		expect(telemetryDisabled({ NODE_ENV: "test" })).toBe(true);
	});

	it("honours OPENVZ_TELEMETRY_DISABLED", () => {
		expect(telemetryDisabled({ OPENVZ_TELEMETRY_DISABLED: "1" })).toBe(true);
	});

	it("honours DO_NOT_TRACK", () => {
		expect(telemetryDisabled({ DO_NOT_TRACK: "1" })).toBe(true);
	});

	it("takes any of the obvious ways to say yes", () => {
		for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
			expect(telemetryDisabled({ DO_NOT_TRACK: value })).toBe(true);
		}
	});

	it("does not read an empty or negative value as a yes", () => {
		for (const value of ["", " ", "0", "false", "no"]) {
			expect(
				telemetryDisabled({
					[ENABLE_VARIABLE]: "1",
					OPENVZ_TELEMETRY_DISABLED: value,
				}),
			).toBe(false);
		}
	});

	it("names both variables so the docs and the code cannot drift", () => {
		expect(DISABLE_VARIABLES).toEqual([
			"OPENVZ_TELEMETRY_DISABLED",
			"DO_NOT_TRACK",
		]);
	});
});
