"use client";

import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
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
} from "@openvz/ui/components/alert-dialog";
import { Button } from "@openvz/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@openvz/ui/components/dropdown-menu";
import { Icon } from "@openvz/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	type RecordKind,
	type RecordRef,
	useRecordStack,
} from "./record-stack";

const NOUN: Record<RecordKind, string> = {
	company: "company",
	contact: "contact",
	deal: "deal",
};

function useDeleteRecord(record: RecordRef) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { close } = useRecordStack();

	const handlers = {
		onSuccess: (deleted: { name: string }) => {
			toast.success(
				`${deleted.name || `The ${NOUN[record.kind]}`} was deleted.`,
			);
			void cache.removed(record);
			close();
		},
		onError: (error: { message: string }) => toast.error(error.message),
	};

	const options =
		record.kind === "contact"
			? trpc.contacts.delete.mutationOptions(handlers)
			: record.kind === "company"
				? trpc.companies.delete.mutationOptions(handlers)
				: trpc.deals.delete.mutationOptions(handlers);

	return useMutation(options);
}

export function RecordActions({
	record,
	name,
	consequence,
}: {
	record: RecordRef;
	name: string;
	consequence: string;
}) {
	const t = useTranslations("crm.recordActions");
	const [confirming, setConfirming] = useState(false);
	const remove = useDeleteRecord(record);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" disabled={remove.isPending}>
						<Icon icon={OverflowMenuVertical} />
						<span className="sr-only">{t("moreActions")}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-44">
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<Icon icon={TrashCan} />
						Delete {NOUN[record.kind]}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {name}?</AlertDialogTitle>
						<AlertDialogDescription>{consequence}</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => remove.mutate({ id: record.id })}
						>
							{t("delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
