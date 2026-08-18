"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@openvz/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@openvz/ui/components/select";
import { useLocale, useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { toast } from "sonner";
import { chooseLocale } from "@/i18n/actions";
import { LOCALE_NAMES, LOCALES } from "@/i18n/locale";

export function LanguageForm() {
	const t = useTranslations("settings.language");
	const locale = useLocale();
	const selectId = useId();
	const [pending, startTransition] = useTransition();

	function change(value: string) {
		startTransition(() => {
			chooseLocale(value).catch(() => {
				toast.error(t("failed"));
			});
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>

			<CardContent>
				<Field>
					<FieldLabel htmlFor={selectId}>{t("label")}</FieldLabel>
					<Select disabled={pending} onValueChange={change} value={locale}>
						<SelectTrigger id={selectId}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LOCALES.map((option) => (
								<SelectItem key={option} value={option}>
									{LOCALE_NAMES[option]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldDescription>{t("hint")}</FieldDescription>
				</Field>
			</CardContent>
		</Card>
	);
}
