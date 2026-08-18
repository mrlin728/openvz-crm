"use client";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { PageShellDescription, PageShellTitle } from "@/components/page-shell";
import { overviewParsers } from "./overview-search-params";

export function OverviewGreetingFallback() {
	const t = useTranslations("overview");
	return (
		<>
			<PageShellTitle>{t("welcome")}</PageShellTitle>
			<PageShellDescription>
				What you have closed, what is still in play, and what needs you today.
			</PageShellDescription>
		</>
	);
}

export function OverviewGreeting() {
	const t = useTranslations("overview");
	const [scope] = useQueryState("scope", overviewParsers.scope);

	return (
		<>
			<PageShellTitle>{t("welcome")}</PageShellTitle>
			<PageShellDescription>
				{scope === "me" ? t("mine") : t("team")}
			</PageShellDescription>
		</>
	);
}
