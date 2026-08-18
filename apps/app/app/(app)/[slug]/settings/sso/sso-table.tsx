"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@openvz/ui/components/alert-dialog";
import { Button } from "@openvz/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
} from "@openvz/ui/components/data-table";
import { Icon } from "@openvz/ui/components/icon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CopyValue } from "./copy-value";
import { ssoSearchParams } from "./sso-search-params";

type ProviderRow = RouterOutputs["sso"]["list"]["rows"][number];

type Translate = ReturnType<typeof useTranslations<"settings.sso">>;

function columns(
	t: Translate,
	canConfigure: boolean,
	onRemove: (provider: ProviderRow) => void,
	pending: boolean,
): DataTableColumn<ProviderRow>[] {
	return [
		{
			id: "providerId",
			header: t("provider"),
			sortable: true,
			hideable: false,
			width: "w-[30%]",
			cell: (row) => (
				<span className="flex min-w-0 flex-col">
					<span className="truncate font-medium">{row.name}</span>
					<span className="truncate text-muted-foreground text-xs">
						{row.type === "saml" ? "SAML" : "OpenID Connect"}
						{row.clientIdLastFour ? ` · client …${row.clientIdLastFour}` : ""}
					</span>
				</span>
			),
		},
		{
			id: "domain",
			header: t("emailDomain"),
			sortable: true,
			width: "w-[22%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="truncate text-muted-foreground">
					{row.domains.join(", ")}
				</span>
			),
		},
		{
			id: "issuer",
			header: t("issuer"),
			sortable: true,
			width: "w-[22%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.issuer}</span>
			),
		},
		{
			id: "callbackURL",
			header: t("redirectUri"),
			width: "w-[20%]",
			hideBelow: "lg",
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-1 text-muted-foreground">
					<span className="truncate">{row.callbackURL}</span>
					<CopyValue value={row.callbackURL} label={t("redirectUri")} />
				</span>
			),
		},
		{
			id: "actions",
			header: <span className="sr-only">Actions</span>,
			label: t("actions"),
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) =>
				canConfigure ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="ghost" size="icon" disabled={pending}>
								<Icon icon={TrashCan} />
								<span className="sr-only">Remove {row.name}</span>
							</Button>
						</AlertDialogTrigger>

						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Remove {row.name}?</AlertDialogTitle>
								<AlertDialogDescription>
									Nobody can sign in through it again. If this is the only
									provider, the sign-in page goes back to Google.
								</AlertDialogDescription>
							</AlertDialogHeader>

							<AlertDialogFooter>
								<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={() => onRemove(row)}
								>
									Remove
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null,
		},
	];
}

export function SsoTable() {
	const t = useTranslations("settings.sso");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { query, input } = useTableQuery(ssoSearchParams);

	const settings = useQuery(trpc.sso.settings.queryOptions());
	const providers = useQuery({
		...trpc.sso.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const remove = useMutation(
		trpc.sso.remove.mutationOptions({
			onSuccess: async () => {
				await cache.sso();
				toast.success(t("removed"));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder={t("search")} />}
			columns={columns(
				t,
				settings.data?.canConfigure ?? false,
				(provider) => remove.mutate({ providerId: provider.providerId }),
				remove.isPending,
			)}
			rows={providers.data?.rows ?? []}
			total={providers.data?.total ?? 0}
			getRowId={(row) => row.providerId}
			loading={providers.isFetching}
			empty={t("empty")}
		/>
	);
}
