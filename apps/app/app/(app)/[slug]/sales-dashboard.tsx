"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import type { ChartConfig } from "@openvz/ui/components/chart";
import { DashboardRow, StatGroup } from "@openvz/ui/components/dashboard";
import { StatCard, type StatDelta } from "@openvz/ui/components/stat-card";
import {
	formatCount,
	formatMoney,
	formatMoneyCompact,
	formatPercent,
} from "@openvz/ui/lib/format";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AreaTrend, DonutStat } from "@/components/dashboard-charts";
import { dealStageColor, dealStageLabel } from "@/lib/deal-stage";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Summary = RouterOutputs["dashboard"]["summary"];

type Translate = ReturnType<typeof useTranslations<"overview">>;

const trendConfigFor = (t: Translate): ChartConfig => ({
	won: { label: t("closedWon"), color: "var(--success)" },
	created: { label: t("newPipeline"), color: "var(--chart-1)" },
});

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

export function SalesDashboard({ summary }: { summary: Summary }) {
	const t = useTranslations("overview");
	const workspaceUrl = useWorkspaceUrl();

	const {
		pipeline,
		wonThisMonth,
		wonPrevMonth,
		performance,
		trend,
		closingThisMonthTotal,
		reportingCurrency,
		unconverted,
	} = summary;

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);

	const hasTrend = trend.some((point) => point.won > 0 || point.created > 0);

	const stageSlices = pipeline.stages.flatMap((stage) =>
		stage.valueCents > 0
			? [
					{
						key: stage.stage,
						label: dealStageLabel(stage.stage),
						value: stage.valueCents,
						color: dealStageColor(stage.stage),
						count: stage.count,
					},
				]
			: [],
	);

	return (
		<div className="flex flex-col gap-6">
			<StatGroup>
				<StatCard
					label={t("closedWonThisMonth")}
					value={money(wonThisMonth.valueCents)}
					delta={changeDelta(
						wonThisMonth.valueCents,
						wonPrevMonth.valueCents,
						"vs. last month",
					)}
					description={`${formatCount(wonThisMonth.count, "deal")} · ${money(wonPrevMonth.valueCents)} last month`}
				/>
				<StatCard
					label={t("openPipeline")}
					value={money(pipeline.totalCents)}
					description={`${formatCount(pipeline.totalDeals, "deal")} in progress · ${money(closingThisMonthTotal.valueCents)} due this month`}
				/>
				<StatCard
					label={`Win rate (${performance.windowDays}d)`}
					value={
						performance.winRate === null
							? "—"
							: formatPercent(performance.winRate)
					}
					description={
						performance.wins + performance.losses === 0
							? t("nothingClosed")
							: `${performance.wins} won · ${performance.losses} lost`
					}
				/>
				<StatCard
					label={`Average deal (${performance.windowDays}d)`}
					value={
						performance.avgDealCents === null
							? "—"
							: money(performance.avgDealCents)
					}
					description={
						performance.avgCycleDays === null
							? t("noWins")
							: `${performance.avgCycleDays}-day average cycle`
					}
				/>
			</StatGroup>

			{unconverted.count > 0 ? (
				<p className="text-muted-foreground text-xs">
					Every figure above is in {reportingCurrency}.{" "}
					{formatCount(unconverted.count, "deal")} in{" "}
					{unconverted.currencies.join(", ")}{" "}
					{unconverted.count === 1 ? "is" : "are"} not included — there is no
					rate to convert {unconverted.currencies.length === 1 ? "it" : "them"}{" "}
					with.{" "}
					<Link
						href={workspaceUrl("/settings/currencies")}
						className="underline hover:no-underline"
					>
						Set one
					</Link>
					.
				</p>
			) : null}

			<DashboardRow split="hero">
				<ChartPanel
					title={t("wonVsNew")}
					description={t("wonVsNewDescription")}
				>
					{hasTrend ? (
						<div className="flex flex-1 flex-col justify-center py-4">
							<AreaTrend
								data={trend}
								config={trendConfigFor(t)}
								xKey="month"
								height={196}
								variant="gradient"
								bloom="high"
								showLegend
								formatValue={exact}
							/>
						</div>
					) : (
						<EmptyChart label={t("noDealsYet")} />
					)}
				</ChartPanel>

				<ChartPanel
					title={t("pipelineByStage")}
					description={t("pipelineByStageDescription")}
				>
					{stageSlices.length > 0 ? (
						<div className="flex flex-1 flex-col justify-between gap-1 pt-4">
							<DonutStat
								data={stageSlices}
								height={168}
								centerValue={money(pipeline.totalCents)}
								centerLabel="open"
								formatValue={exact}
							/>
							<ul className="flex flex-col px-5 pb-1 md:px-6">
								{stageSlices.map((slice) => (
									<li key={slice.key} className="border-t first:border-t-0">
										<Link
											href={`${workspaceUrl("/deals")}?stage=${slice.key}`}
											className="flex items-center gap-2.5 py-2 text-xs hover:underline"
										>
											<span
												aria-hidden
												className="size-1.5 shrink-0"
												style={{ backgroundColor: slice.color }}
											/>
											<span className="min-w-0 flex-1 truncate">
												{slice.label}
											</span>
											<span className="shrink-0 text-muted-foreground tabular-nums">
												{slice.count}
											</span>
											<span className="w-14 shrink-0 text-right font-medium tabular-nums">
												{money(slice.value)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyChart label={t("nothingOpen")} />
					)}
				</ChartPanel>
			</DashboardRow>
		</div>
	);
}

function ChartPanel({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<div className="flex flex-1 flex-col border">{children}</div>
		</Card>
	);
}

function EmptyChart({ label }: { label: string }) {
	return (
		<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
			{label}
		</div>
	);
}
