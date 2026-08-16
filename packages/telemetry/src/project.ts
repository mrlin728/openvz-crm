export function posthogKey(): string {
	return (
		process.env.OPENVZ_POSTHOG_KEY ??
		process.env.NEXT_PUBLIC_OPENVZ_POSTHOG_KEY ??
		""
	);
}

export function posthogHost(): string {
	return (
		process.env.OPENVZ_POSTHOG_HOST ??
		process.env.NEXT_PUBLIC_OPENVZ_POSTHOG_HOST ??
		"https://us.i.posthog.com"
	);
}

export const POSTHOG_UI_HOST = "https://us.posthog.com";
