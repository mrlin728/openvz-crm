"use client";

import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@openvz/ui/components/data-table";
import { EmptyCellValue } from "@openvz/ui/components/empty-cell";
import { useTableSelection } from "@openvz/ui/hooks/use-table-selection";
import { formatMoney } from "@openvz/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { CLOSING_OPTIONS } from "@/components/crm/closing-window";
import { CompanyCell } from "@/components/crm/company-cell";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { DealStageMenu } from "@/components/crm/stage-change";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { DEAL_STAGE_OPTIONS } from "@/lib/deal-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DealsBulkActions } from "./deals-bulk-actions";
import { dealsSearchParams } from "./deals-search-params";

type DealRow = RouterOutputs["deals"]["list"]["rows"][number];

type Translate = ReturnType<typeof useTranslations<"deals.columns">>;

const columnsFor = (t: Translate): DataTableColumn<DealRow>[] => [
	{
		id: "name",
		header: t("name"),
		sortable: true,
		hideable: false,
		width: "w-[24%]",
		cell: (row) => <span className="truncate font-medium">{row.name}</span>,
	},
	{
		id: "company",
		header: t("company"),
		sortable: true,
		width: "w-[18%]",
		cell: (row) => <CompanyCell company={row.company} />,
	},
	{
		id: "stage",
		header: t("stage"),
		sortable: true,
		width: "w-[18%]",
		cell: (row) => <DealStageMenu dealId={row.id} stage={row.stage} />,
	},
	{
		id: "amount",
		header: t("amount"),
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) =>
			row.amountCents === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">
					{formatMoney(row.amountCents, row.currency)}
				</span>
			),
	},
	{
		id: "owner",
		header: t("owner"),
		sortable: true,
		width: "w-[14%]",
		hideBelow: "md",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "expectedCloseDate",
		header: t("closeDate"),
		sortable: true,
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) =>
			row.expectedCloseDate ? (
				<span className="text-muted-foreground">
					<LocalDay date={row.expectedCloseDate} />
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "createdAt",
		header: t("created"),
		label: t("createdDate"),
		sortable: true,
		align: "right",
		width: "w-[10%]",
		defaultHidden: true,
		cell: (row) => (
			<span className="text-muted-foreground">
				<LocalRelativeTime date={row.createdAt} />
			</span>
		),
	},
	{
		id: "lastActivity",
		header: t("lastActivity"),
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
		),
	},
];

export function DealsTable() {
	const t = useTranslations("deals.columns");
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const prefetchRecord = usePrefetchRecord();
	const { query, input } = useTableQuery(dealsSearchParams);

	const deals = useQuery({
		...trpc.deals.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = deals.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = deals.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "owner",
			label: t("owner"),
			options: (users.data ?? []).flatMap((user) =>
				(facetCounts?.owner?.[user.id] ?? 0) > 0
					? [{ value: user.id, label: user.name }]
					: [],
			),
		},
		{
			id: "stage",
			label: t("stage"),
			options: DEAL_STAGE_OPTIONS.filter(
				(option) => (facetCounts?.stage?.[option.value] ?? 0) > 0,
			),
		},
		{
			id: "closing",
			label: t("closing"),
			options: CLOSING_OPTIONS.flatMap((option) =>
				(facetCounts?.closing?.[option.value] ?? 0) > 0
					? [{ value: option.value, label: option.label }]
					: [],
			),
		},
	];

	const openValueCents = deals.data?.openValueCents;
	const reportingCurrency = deals.data?.reportingCurrency;
	const unconverted = deals.data?.unconverted;
	const uncounted = unconverted?.count ?? 0;
	const openPipelineCents = openValueCents ?? (uncounted > 0 ? 0 : null);

	const fieldColumns = useFieldColumns<DealRow>("DEAL");
	const columns = useMemo(
		() => [...columnsFor(t), ...fieldColumns],
		[fieldColumns, t],
	);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder={t("search")} />}
			columns={columns}
			rows={rows}
			total={deals.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			tabs={{
				id: "status",
				allLabel: "All deals",
				options: [
					{ value: "open", label: t("open") },
					{ value: "closed", label: t("closed") },
				],
			}}
			selection={{
				state: selection,
				actions: (
					<DealsBulkActions ids={selection.ids} onDone={selection.clear} />
				),
				rowLabel: (row) => row.name,
			}}
			getRowId={(row) => row.id}
			loading={deals.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "deal", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "deal", id: row.id })}
			empty={t("empty")}
			meta={
				openPipelineCents === null ? undefined : (
					<span>
						{deals.data?.total ?? 0} deals ·{" "}
						<span className="tabular-nums">
							{formatMoney(openPipelineCents, reportingCurrency)}
						</span>{" "}
						open pipeline
						{unconverted && unconverted.count > 0 ? (
							<span className="text-muted-foreground">
								{" "}
								· {unconverted.count} not counted (no{" "}
								{unconverted.currencies.join(", ")} rate)
							</span>
						) : null}
					</span>
				)
			}
		/>
	);
}
