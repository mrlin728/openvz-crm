"use client";

import {
	ToggleGroup,
	ToggleGroupItem,
} from "@openvz/ui/components/toggle-group";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import {
	OVERVIEW_SCOPES,
	type OverviewScope,
	overviewParsers,
} from "./overview-search-params";

const LABELS: Record<OverviewScope, string> = {
	me: "me",
	everyone: "everyone",
};

function isScope(value: string): value is OverviewScope {
	return (OVERVIEW_SCOPES as readonly string[]).includes(value);
}

export function OverviewScopeToggleFallback() {
	const t = useTranslations("overview");
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			disabled
			aria-label={t("whose")}
		>
			{OVERVIEW_SCOPES.map((value) => (
				<ToggleGroupItem key={value} value={value}>
					{t(LABELS[value])}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

export function OverviewScopeToggle() {
	const t = useTranslations("overview");
	const [scope, setScope] = useQueryState("scope", overviewParsers.scope);

	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			value={scope}
			onValueChange={(next) => {
				if (isScope(next)) void setScope(next);
			}}
			aria-label={t("whose")}
		>
			{OVERVIEW_SCOPES.map((value) => (
				<ToggleGroupItem key={value} value={value}>
					{t(LABELS[value])}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
