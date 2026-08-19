"use client";

import { workspaceSlug } from "@openvz/db/workspace";
import { Button } from "@openvz/ui/components/button";
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
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function OnboardingForm({ placeholder }: { placeholder: string }) {
	const t = useTranslations("onboarding");
	const trpc = useTRPC();
	const router = useRouter();

	const nameId = useId();
	const slugId = useId();
	const websiteId = useId();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const slugEdited = useRef(false);

	const save = useMutation(
		trpc.workspace.update.mutationOptions({
			onSuccess: () => {
				router.refresh();
				router.replace("/onboarding/research");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();

				const form = new FormData(event.currentTarget);

				save.mutate({
					name: String(form.get("name") ?? "").trim(),
					slug: workspaceSlug(String(form.get("slug") ?? "")),
					website: String(form.get("website") ?? "").trim(),
				});
			}}
			className="flex flex-col gap-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={nameId}>{t("companyName")}</FieldLabel>
					<Input
						id={nameId}
						name="name"
						value={name}
						onChange={(event) => {
							const next = event.target.value;
							setName(next);
							if (!slugEdited.current) setSlug(workspaceSlug(next));
						}}
						placeholder={placeholder}
						autoComplete="organization"
						autoFocus
						required
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={slugId}>{t("workspaceUrl")}</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<InputGroupText>/</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id={slugId}
							name="slug"
							value={slug}
							onChange={(event) => {
								slugEdited.current = true;
								setSlug(workspaceSlugDraft(event.target.value));
							}}
							onBlur={() =>
								setSlug((value) => (value ? workspaceSlug(value) : ""))
							}
							placeholder={workspaceSlug(placeholder)}
							autoComplete="off"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							required
						/>
					</InputGroup>
					<FieldDescription>{t("workspaceUrlHint")}</FieldDescription>
				</Field>

				<Field>
					<FieldLabel htmlFor={websiteId}>{t("website")}</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<InputGroupText>https://</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id={websiteId}
							name="website"
							placeholder="acme.com"
							autoComplete="off"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							inputMode="url"
							required
						/>
					</InputGroup>
					<FieldDescription>{t("websiteHint")}</FieldDescription>
				</Field>
			</FieldGroup>

			<Button type="submit" disabled={save.isPending}>
				{save.isPending ? <Spinner data-icon="inline-start" /> : null}
				Continue
			</Button>
		</form>
	);
}

function workspaceSlugDraft(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+/, "");
}
