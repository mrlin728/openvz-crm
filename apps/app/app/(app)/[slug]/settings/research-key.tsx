"use client";

import { CONTEXT_DEV_SIGNUP_URL } from "@openvz/db/settings";
import { Button } from "@openvz/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@openvz/ui/components/field";
import { Input } from "@openvz/ui/components/input";
import { Spinner } from "@openvz/ui/components/spinner";
import { StatusIndicator } from "@openvz/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function ResearchKey() {
	const t = useTranslations("settings.researchKey");
	const trpc = useTRPC();
	const cache = useCrmCache();

	const keyId = useId();
	const [draft, setDraft] = useState("");

	const key = useQuery(trpc.settings.researchKey.queryOptions());

	const save = useMutation(
		trpc.settings.setResearchKey.mutationOptions({
			onSuccess: async () => {
				await cache.settings();
				setDraft("");
				toast.success(t("saved"));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!key.data) return null;

	const { configured, hint } = key.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>

				<CardAction>
					<Button
						type="submit"
						form="research-key"
						disabled={save.isPending || draft.trim() === ""}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						{t(configured ? "replace" : "save")}
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="research-key"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ apiKey: draft.trim() });
					}}
				>
					<FieldGroup>
						<Field>
							<div className="flex items-center justify-between gap-3">
								<FieldLabel htmlFor={keyId}>{t("label")}</FieldLabel>
								<StatusIndicator
									size="sm"
									tone={configured ? "success" : "warning"}
									label={t(configured ? "connected" : "notConnected")}
								/>
							</div>
							<Input
								id={keyId}
								type="password"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder={hint ?? t("placeholder")}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={save.isPending}
							/>
							<FieldDescription>
								Don't have a Context API key?{" "}
								<a
									href={CONTEXT_DEV_SIGNUP_URL}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-4 hover:text-foreground"
								>
									Sign up here
								</a>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
