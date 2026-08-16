"use client";

import {
	POSTHOG_UI_HOST,
	posthogHost,
	posthogKey,
} from "@openvz/telemetry/project";
import { useMountEffect } from "@openvz/ui/hooks/use-mount-effect";
import { analyticsAllowed } from "@/lib/analytics";

export type CtaLocation = "hero" | "closing";

export function LandingAnalytics() {
	useMountEffect(() => {
		if (!posthogKey()) return;
		if (!analyticsAllowed(window.location.hostname)) return;

		import("posthog-js")
			.then(({ default: posthog }) => {
				posthog.init(posthogKey(), {
					api_host: posthogHost(),
					ui_host: POSTHOG_UI_HOST,
					defaults: "2026-06-25",
				});
			})
			.catch(() => {});
	});

	return null;
}

export function captureLanding(
	event: "setup_prompt_copied" | "github_star_clicked",
	location: CtaLocation,
): void {
	if (typeof window === "undefined") return;
	if (!posthogKey()) return;
	if (!analyticsAllowed(window.location.hostname)) return;

	import("posthog-js")
		.then(({ default: posthog }) => {
			posthog.capture(event, { cta_location: location });
		})
		.catch(() => {});
}
