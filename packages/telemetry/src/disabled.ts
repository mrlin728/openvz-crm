const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const DISABLE_VARIABLES = ["OPENVZ_TELEMETRY_DISABLED", "DO_NOT_TRACK"];

export const ENABLE_VARIABLE = "OPENVZ_TELEMETRY_ENABLED";

export function telemetryDisabled(
	env: Record<string, string | undefined> = process.env,
): boolean {
	if (env.NODE_ENV === "test") return true;

	if (DISABLE_VARIABLES.some((name) => isTruthy(env[name]))) return true;

	return !isTruthy(env[ENABLE_VARIABLE]);
}

function isTruthy(value: string | undefined): boolean {
	return TRUTHY.has((value ?? "").trim().toLowerCase());
}
