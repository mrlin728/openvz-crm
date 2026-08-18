"use client";

import { Button } from "@openvz/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@openvz/ui/components/card";
import { CardTableEmpty } from "@openvz/ui/components/card-table";
import { Checkbox } from "@openvz/ui/components/checkbox";
import { EmptyCellValue } from "@openvz/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@openvz/ui/components/entity-logo";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@openvz/ui/components/simple-table";
import { Spinner } from "@openvz/ui/components/spinner";
import { StatusIndicator } from "@openvz/ui/components/status-indicator";
import { TableCell } from "@openvz/ui/components/table";
import { formatMoneyCompact } from "@openvz/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "sonner";
import { DealStageIndicator } from "@/components/crm/deal-stage";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/lib/activity-presentation";
import { dealStageColor } from "@/lib/deal-stage";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { overviewParsers } from "./overview-search-params";
import { SalesDashboard } from "./sales-dashboard";

const CELL = "px-3 py-2.5 align-middle";
type Translate = ReturnType<typeof useTranslations<"overview">>;

const openColumnsFor = (t: Translate): SimpleTableColumn[] => [
	{ id: "deal", header: t("deal") },
	{
		id: "stage",
		header: t("stage"),
		width: "w-32",
		className: "hidden lg:table-cell",
	},
	{
		id: "share",
		srLabel: t("shareOfLargest"),
		width: "w-24",
		className: "hidden sm:table-cell",
	},
	{ id: "value", header: t("value"), width: "w-20", align: "right" },
];
const taskColumnsFor = (t: Translate): SimpleTableColumn[] => [
	{ id: "done", srLabel: t("done"), width: "w-8" },
	{ id: "task", header: t("task") },
	{ id: "overdue", header: t("overdue"), width: "w-24", align: "right" },
];
const activityColumnsFor = (t: Translate): SimpleTableColumn[] => [
	{ id: "activity", header: t("activity") },
	{
		id: "company",
		header: t("company"),
		width: "w-44",
		className: "hidden md:table-cell",
	},
	{
		id: "deal",
		header: t("deal"),
		width: "w-48",
		className: "hidden lg:table-cell",
	},
	{
		id: "who",
		header: "Who",
		width: "w-32",
		className: "hidden md:table-cell",
	},
	{ id: "when", header: t("when"), width: "w-20", align: "right" },
];

export function DashboardSummary() {
	const t = useTranslations("overview");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();
	const workspaceUrl = useWorkspaceUrl();

	const [scope] = useQueryState("scope", overviewParsers.scope);

	const summaryQuery = useQuery({
		...trpc.dashboard.summary.queryOptions({ scope }),
		placeholderData: (previous) => previous,
	});

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const summary = summaryQuery.data;

	if (!summary) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const { biggestOpen, overdueTasks, recentActivity } = summary;

	const mine = scope === "me";
	const largestOpenCents = biggestOpen[0]?.baseAmountCents ?? 0;

	return (
		<div className="flex flex-col gap-6">
			<SalesDashboard summary={summary} />

			<div className="grid gap-6 @3xl/page-content:grid-cols-2">
				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>{t("dealsInProgress")}</CardTitle>
						<CardDescription>{t("dealsInProgressDescription")}</CardDescription>
						<CardAction>
							<Button asChild variant="contrast" size="sm">
								<Link href={workspaceUrl("/deals")}>{t("openDeals")}</Link>
							</Button>
						</CardAction>
					</CardHeader>
					<CardPanel>
						{biggestOpen.length === 0 ? (
							<CardPanelEmpty>
								Nothing open. Time to fill the pipeline.
							</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={openColumnsFor(t)}
							>
								{biggestOpen.map((deal) => (
									<SimpleTableRow
										key={deal.id}
										clickable
										onClick={() => openRecord({ kind: "deal", id: deal.id })}
									>
										<TableCell className={CELL}>
											<DealCell
												name={deal.name}
												company={deal.company}
												meta={<LocalRelativeTime date={deal.stageChangedAt} />}
											/>
										</TableCell>
										<TableCell className={`${CELL} hidden lg:table-cell`}>
											<DealStageIndicator stage={deal.stage} />
										</TableCell>
										<TableCell className={`${CELL} hidden sm:table-cell`}>
											<ValueMeter
												share={
													largestOpenCents > 0
														? ((deal.baseAmountCents ?? 0) / largestOpenCents) *
															100
														: 0
												}
												color={dealStageColor(deal.stage)}
											/>
										</TableCell>
										<TableCell className={`${CELL} text-right tabular-nums`}>
											{deal.amountCents === null ? (
												<EmptyCellValue />
											) : (
												formatMoneyCompact(deal.amountCents, deal.currency)
											)}
										</TableCell>
									</SimpleTableRow>
								))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>

				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>{t("overdueTasks")}</CardTitle>
						<CardDescription>
							{overdueTasks.length === 0
								? t("nothingOverdue")
								: t("pastDue", { count: overdueTasks.length })}
						</CardDescription>
					</CardHeader>
					<CardPanel>
						{overdueTasks.length === 0 ? (
							<CardPanelEmpty>{t("nothingOverdueGood")}</CardPanelEmpty>
						) : (
							<SimpleTable
								variant="panel"
								surface="page"
								columns={taskColumnsFor(t)}
							>
								{overdueTasks.map((task) => (
									<SimpleTableRow key={task.id}>
										<TableCell className={CELL}>
											<Checkbox
												checked={false}
												disabled={complete.isPending}
												aria-label={t("markAsDone")}
												onCheckedChange={() =>
													complete.mutate({ id: task.id, completed: true })
												}
											/>
										</TableCell>
										<TableCell className={CELL}>
											<span className="flex min-w-0 flex-col">
												<span className="truncate">{task.subject}</span>
												<span className="flex min-w-0 text-muted-foreground">
													{task.deal ? (
														<RecordLink kind="deal" id={task.deal.id}>
															{task.deal.name}
														</RecordLink>
													) : task.company ? (
														<RecordLink kind="company" id={task.company.id}>
															{task.company.name}
														</RecordLink>
													) : null}
												</span>
											</span>
										</TableCell>
										<TableCell className={`${CELL} text-right`}>
											<StatusIndicator
												tone="error"
												label={
													task.dueAt ? (
														<LocalRelativeTime date={task.dueAt} />
													) : (
														t("noDueDate")
													)
												}
											/>
										</TableCell>
									</SimpleTableRow>
								))}
							</SimpleTable>
						)}
					</CardPanel>
				</Card>
			</div>

			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>{t(mine ? "yourActivity" : "recentActivity")}</CardTitle>
					<CardDescription>
						{mine ? t("activityMine") : t("activityAll")}
					</CardDescription>
					<CardAction>
						<Button asChild variant="contrast" size="sm">
							<Link href={workspaceUrl("/companies")}>{t("allCompanies")}</Link>
						</Button>
					</CardAction>
				</CardHeader>
				{recentActivity.length === 0 ? (
					<CardTableEmpty>{t("nothingHappened")}</CardTableEmpty>
				) : (
					<SimpleTable columns={activityColumnsFor(t)}>
						{recentActivity.map((entry) => (
							<SimpleTableRow key={entry.id}>
								<TableCell className={CELL}>
									<span className="truncate">
										{entry.subject ?? activityLabel(entry.type)}
									</span>
								</TableCell>
								<TableCell className={`${CELL} hidden md:table-cell`}>
									{entry.company ? (
										<RecordLink kind="company" id={entry.company.id}>
											{entry.company.name}
										</RecordLink>
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell className={`${CELL} hidden lg:table-cell`}>
									{entry.deal ? (
										<RecordLink kind="deal" id={entry.deal.id}>
											{entry.deal.name}
										</RecordLink>
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell
									className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
								>
									{entry.createdBy.name}
								</TableCell>
								<TableCell
									className={`${CELL} text-right text-muted-foreground`}
								>
									<LocalRelativeTime date={entry.createdAt} />
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</Card>
		</div>
	);
}

function DealCell({
	name,
	company,
	meta,
}: {
	name: string;
	company: {
		name: string;
		iconUrl: string | null;
		iconDarkUrl: string | null;
		iconTone: string | null;
	};
	meta?: ReactNode;
}) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<EntityLogo
				src={company.iconUrl}
				darkSrc={company.iconDarkUrl}
				tone={company.iconTone as EntityLogoTone | null | undefined}
				name={company.name}
				size="sm"
			/>
			<span className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{name}</span>
				<span className="truncate text-muted-foreground">
					{meta ? (
						<>
							{company.name} · {meta}
						</>
					) : (
						company.name
					)}
				</span>
			</span>
		</span>
	);
}

function ValueMeter({ share, color }: { share: number; color: string }) {
	return (
		<span
			className="bloom-low flex h-1.5 w-full overflow-hidden bg-muted"
			style={{ "--bloom-color": color } as CSSProperties}
		>
			<span
				className="h-full w-(--share)"
				style={
					{
						backgroundColor: color,
						"--share": `${Math.round(Math.max(Math.min(share, 100), 0))}%`,
					} as CSSProperties
				}
			/>
		</span>
	);
}
