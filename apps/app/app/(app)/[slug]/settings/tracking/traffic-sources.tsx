"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import { CardTableEmpty } from "@openvz/ui/components/card-table";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@openvz/ui/components/simple-table";
import { TableCell } from "@openvz/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTRPC } from "@/lib/trpc/client";

const CELL = "px-3 py-2.5 align-middle";

type Translate = ReturnType<typeof useTranslations<"settings.tracking">>;

const columnsFor = (t: Translate): SimpleTableColumn[] => [
	{ id: "source", header: t("source") },
	{ id: "medium", header: t("medium"), width: "w-32" },
	{ id: "views", header: t("pageViews"), width: "w-28", align: "right" },
	{ id: "contacts", header: t("contacts"), width: "w-24", align: "right" },
];

export function TrafficSources() {
	const t = useTranslations("settings.tracking");
	const trpc = useTRPC();
	const sources = useQuery(trpc.tracking.sources.queryOptions());

	if (!sources.data) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("trafficSources")}</CardTitle>
				<CardDescription>{t("trafficSourcesDescription")}</CardDescription>
			</CardHeader>

			{sources.data.length === 0 ? (
				<CardTableEmpty>
					No sources yet. They appear once the script records its first page
					view.
				</CardTableEmpty>
			) : (
				<SimpleTable columns={columnsFor(t)}>
					{sources.data.map((row) => (
						<SimpleTableRow key={`${row.source}-${row.medium ?? ""}`}>
							<TableCell className={CELL}>{row.source}</TableCell>
							<TableCell className={`${CELL} text-muted-foreground`}>
								{row.medium ?? "—"}
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{row.views.toLocaleString()}
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{row.contacts.toLocaleString()}
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}
		</Card>
	);
}
