"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import { Label } from "@openvz/ui/components/label";
import { Switch } from "@openvz/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const RULES = [
	{
		flag: "crossDomain",
		labelKey: "crossDomain",
		hintKey: "crossDomainHint",
	},
	{
		flag: "limitToDomains",
		labelKey: "limitDomains",
		hintKey: "limitDomainsHint",
	},
] as const;

export function TrackingRules() {
	const t = useTranslations("settings.tracking");
	const trpc = useTRPC();
	const cache = useCrmCache();

	const tracking = useQuery(trpc.tracking.settings.queryOptions());

	const setFlag = useMutation(
		trpc.tracking.setFlag.mutationOptions({
			onSuccess: () => cache.tracking({ settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!tracking.data) return null;

	const { canManage } = tracking.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("rules")}</CardTitle>
				<CardDescription>{t("rulesDescription")}</CardDescription>
			</CardHeader>

			<CardContent>
				{RULES.map((rule) => (
					<div
						key={rule.flag}
						className="flex items-center justify-between gap-6"
					>
						<Label
							htmlFor={`tracking-${rule.flag}`}
							className="flex flex-col items-start gap-1"
						>
							<span className="text-sm">{t(rule.labelKey)}</span>
							<span className="font-normal text-muted-foreground text-xs">
								{t(rule.hintKey)}
							</span>
						</Label>

						<Switch
							id={`tracking-${rule.flag}`}
							checked={tracking.data[rule.flag]}
							disabled={!canManage || setFlag.isPending}
							onCheckedChange={(enabled) =>
								setFlag.mutate({ flag: rule.flag, enabled })
							}
						/>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
