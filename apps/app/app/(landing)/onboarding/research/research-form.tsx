"use client";

import { CONTEXT_DEV_SIGNUP_URL } from "@openvz/db/settings";
import { Button } from "@openvz/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@openvz/ui/components/field";
import { Input } from "@openvz/ui/components/input";
import { Spinner } from "@openvz/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function ResearchForm() {
	const t = useTranslations("onboarding");
	const trpc = useTRPC();
	const router = useRouter();

	const keyId = useId();

	const save = useMutation(
		trpc.settings.setResearchKey.mutationOptions({
			onSuccess: () => {
				router.refresh();
				router.replace("/");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const skip = useMutation(
		trpc.settings.skipResearchKey.mutationOptions({
			onSuccess: () => {
				router.refresh();
				router.replace("/");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const busy = save.isPending || skip.isPending;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const form = new FormData(event.currentTarget);
				save.mutate({ apiKey: String(form.get("apiKey") ?? "").trim() });
			}}
			className="flex flex-col gap-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={keyId}>{t("contextKey")}</FieldLabel>
					<Input
						id={keyId}
						name="apiKey"
						type="password"
						placeholder={t("pasteKey")}
						autoComplete="off"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
						autoFocus
						required
					/>
					<FieldDescription>
						Don't have a Context API key?{" "}
						<a
							href={CONTEXT_DEV_SIGNUP_URL}
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-4 hover:text-foreground"
						>
							{t("signUpHere")}
						</a>
					</FieldDescription>
				</Field>
			</FieldGroup>

			<div className="flex flex-col gap-2">
				<Button type="submit" disabled={busy}>
					{save.isPending ? <Spinner data-icon="inline-start" /> : null}
					Continue
				</Button>

				<Button
					disabled={busy}
					onClick={() => skip.mutate()}
					type="button"
					variant="ghost"
				>
					{skip.isPending ? <Spinner data-icon="inline-start" /> : null}
					Skip for now
				</Button>
			</div>
		</form>
	);
}
