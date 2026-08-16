"use client";

import { signIn } from "@openvz/auth/client";
import type { MailboxProviderId } from "@openvz/auth/scopes";
import GoogleLogo from "@openvz/ui/components/brand-logos/google";
import MicrosoftLogo from "@openvz/ui/components/brand-logos/microsoft";
import { Button } from "@openvz/ui/components/button";
import { Spinner } from "@openvz/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

const PROVIDERS = {
	google: { label: "Continue with Google", Logo: GoogleLogo },
	microsoft: { label: "Continue with Microsoft", Logo: MicrosoftLogo },
} as const satisfies Record<MailboxProviderId, unknown>;

export function SocialSignIn({ provider }: { provider: MailboxProviderId }) {
	const [pending, setPending] = useState(false);

	const { label, Logo } = PROVIDERS[provider];

	function fail(message?: string) {
		setPending(false);
		toast.error(message ?? "Could not reach the sign-in service.");
	}

	async function handleClick() {
		setPending(true);

		const origin = window.location.origin;

		const { error } = await signIn.social({
			provider,
			callbackURL: `${origin}/`,
			errorCallbackURL: `${origin}/sign-in`,
		});

		if (error) fail(error.message);
	}

	return (
		<Button
			className="w-full"
			disabled={pending}
			onClick={() => {
				handleClick().catch(() => fail());
			}}
			type="button"
			variant="outline"
		>
			{pending ? (
				<Spinner data-icon="inline-start" />
			) : (
				<Logo data-icon="inline-start" className="size-4" />
			)}
			{label}
		</Button>
	);
}
