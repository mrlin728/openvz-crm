"use client";

import Renew from "@carbon/icons-react/es/Renew";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@openvz/ui/components/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function CompaniesBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const t = useTranslations("companies.bulk");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.companies.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => t("reassigned", { count }));
				onDone();
			},
			onError,
		}),
	);

	const enrich = useMutation(
		trpc.companies.bulkEnrich.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => t("enriching", { count }));
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.companies.bulkDelete.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "company", ids: variables.ids });
				reportBulk(result, (count) => t("deleted", { count }));
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending = assignOwner.isPending || enrich.isPending || remove.isPending;

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<BulkOwnerMenu
					users={users.data ?? []}
					unassignedLabel={t("nobody")}
					onSelect={(ownerId) => assignOwner.mutate({ ids, ownerId })}
				/>
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={() => enrich.mutate({ ids })}>
						<Renew />
						Re-enrich
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<TrashCan />
						{t("delete")}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</BulkActionsMenu>

			<BulkDeleteDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={t("deleteTitle", { count: ids.length })}
				description={t("deleteDescription")}
				onConfirm={() => remove.mutate({ ids })}
			/>
		</>
	);
}
