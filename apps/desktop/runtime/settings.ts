import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseEnv } from "@openvz/env";
import type { Layout } from "./paths";

const OWNED = new Set([
	"DATABASE_URL",
	"DIRECT_DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"API_URL",
	"APP_URL",
	"PORT",
	"OPENVZ_CRM_HOME",
	"OPENVZ_CRM_RUNTIME",
]);

const TEMPLATE = `# Settings for this copy of OPENVZ CRM. Edit, save, then restart the app.
# Every line is NAME=value. A line starting with # does nothing.

# Let somebody else sign in. Without this, this install allows exactly one
# account — the one that was created first, which owns the workspace. List
# email addresses or whole domains, separated by commas.
# ALLOWED_SIGN_IN="colleague@example.com,acme.com"

# Sign in with Google instead of a password, and let the CRM read Gmail and
# Calendar. Both values come from a Google Cloud OAuth client of your own.
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""

# Send telemetry to a PostHog project of your own. Off, and pointed nowhere,
# unless you set both.
# OPENVZ_TELEMETRY_ENABLED="1"
# OPENVZ_POSTHOG_KEY=""
`;

export async function readOrCreateSettings(
	layout: Layout,
): Promise<Record<string, string>> {
	const existing = await readFile(layout.settings, "utf8").catch(() => null);

	if (existing === null) {
		await mkdir(dirname(layout.settings), { recursive: true });
		await writeFile(layout.settings, TEMPLATE);
		return {};
	}

	const parsed = parseEnv(existing);

	for (const name of OWNED) delete parsed[name];

	return parsed;
}
