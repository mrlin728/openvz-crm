import { join } from "node:path";
import { loadRootEnv } from "@openvz/env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

loadRootEnv();

const apiUrl =
	process.env.API_URL ??
	process.env.NEXT_PUBLIC_API_URL ??
	"http://localhost:3001";

const allowedDevOrigins = (process.env.APP_URL ?? "")
	.split(",")
	.flatMap((origin) => {
		try {
			return [new URL(origin.trim()).hostname];
		} catch {
			return [];
		}
	});

const nextConfig: NextConfig = {
	allowedDevOrigins,

	...(process.env.DESKTOP_BUILD === "1"
		? {
				output: "standalone" as const,
				outputFileTracingRoot: join(import.meta.dirname, "../.."),
				outputFileTracingIncludes: {
					"**/*": ["../../node_modules/@swc/helpers/**"],
				},
			}
		: {}),

	env: {
		NEXT_PUBLIC_API_URL: apiUrl,
	},

	transpilePackages: [
		"@openvz/auth",
		"@openvz/db",
		"@openvz/telemetry",
		"@openvz/ui",
	],

	serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],

	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "**.blob.vercel-storage.com" },
			{ protocol: "https", hostname: "**.r2.dev" },
		],
	},

	cacheComponents: true,
	partialPrefetching: true,
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// The plugin is typed against whichever copy of `next` resolves from
// next-intl, and a hoisted install has one at the workspace root as well as
// one here. They are the same version and the same shape; TypeScript only
// sees two declarations of it.
export default withNextIntl(nextConfig) as NextConfig;
