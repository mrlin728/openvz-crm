"use client";

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
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@openvz/ui/components/input-group";
import { Spinner } from "@openvz/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceSlug } from "@/lib/use-workspace-url";
import { workspaceUrl } from "@/lib/workspace-url";

export function WorkspaceForm() {
	const t = useTranslations("settings.workspace");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const slug = useWorkspaceSlug();

	const nameId = useId();
	const websiteId = useId();

	const workspace = useQuery(trpc.workspace.get.queryOptions());

	const [draft, setDraft] = useState<{ name: string; website: string } | null>(
		null,
	);

	const save = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: async (saved) => {
				await cache.workspace();
				setDraft(null);
				toast.success(t("saved"));

				if (saved.slug !== slug) {
					router.replace(workspaceUrl(saved.slug, "/settings"));
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!workspace.data) return null;

	const { name, website, canRename } = workspace.data;

	const values = draft ?? { name, website: website ?? "" };
	const dirty = values.name !== name || values.website !== (website ?? "");

	const edit = (patch: Partial<typeof values>) =>
		setDraft({ ...values, ...patch });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>

				<CardAction>
					<Button
						type="submit"
						form="workspace"
						disabled={
							!canRename ||
							save.isPending ||
							!dirty ||
							values.name.trim() === "" ||
							values.website.trim() === ""
						}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						{t("save")}
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="workspace"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({
							name: values.name,
							website: values.website.trim(),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>{t("name")}</FieldLabel>
							<Input
								id={nameId}
								value={values.name}
								onChange={(event) => edit({ name: event.target.value })}
								placeholder={t("namePlaceholder")}
								autoComplete="organization"
								disabled={!canRename || save.isPending}
								required
							/>
							<FieldDescription>
								Shown wherever the CRM refers to your own company.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={websiteId}>{t("website")}</FieldLabel>
							<InputGroup>
								<InputGroupAddon>
									<InputGroupText>https://</InputGroupText>
								</InputGroupAddon>
								<InputGroupInput
									id={websiteId}
									value={values.website}
									onChange={(event) => edit({ website: event.target.value })}
									placeholder="acme.com"
									autoComplete="off"
									autoCapitalize="off"
									autoCorrect="off"
									spellCheck={false}
									inputMode="url"
									disabled={!canRename || save.isPending}
								/>
							</InputGroup>
							<FieldDescription>{t("websiteHint")}</FieldDescription>
						</Field>
					</FieldGroup>
				</form>

				{canRename ? null : (
					<p className="text-muted-foreground text-xs">
						Only an owner or an admin can change this.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
