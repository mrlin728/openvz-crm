"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@openvz/ui/components/alert-dialog";
import {
	AsyncButtonContent,
	useAsyncAction,
} from "@openvz/ui/components/async-action";
import { Button } from "@openvz/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function SlackDisconnectButton({
	canManage,
	workspace,
}: {
	canManage: boolean;
	workspace: string | null;
}) {
	const t = useTranslations("settings.slack");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const [confirming, setConfirming] = useState(false);
	const disconnect = useMutation(
		trpc.slack.disconnect.mutationOptions({
			onSuccess: async () => {
				await cache.slack();
				setConfirming(false);
				toast.success(t("disconnected"));
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const disconnectAction = useAsyncAction({
		action: () => disconnect.mutateAsync(),
	});

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				onClick={() => setConfirming(true)}
				disabled={!canManage || disconnectAction.pending}
			>
				Disconnect
			</Button>

			<AlertDialog
				open={confirming}
				onOpenChange={(open) => {
					if (!disconnectAction.pending) setConfirming(open);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("disconnectTitle", { workspace: workspace ?? "Slack" })}
						</AlertDialogTitle>
						<AlertDialogDescription>
							Agents stop sending to Slack immediately, and the cached channel
							list is cleared so a new app re-reads it. Who is matched to which
							Slack account is kept, so reconnecting the same workspace does not
							ask you to match everyone again.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={disconnectAction.pending}>
							Cancel
						</AlertDialogCancel>
						<Button
							variant="destructive"
							disabled={disconnectAction.pending}
							onClick={() => void disconnectAction.run()}
						>
							<AsyncButtonContent
								status={disconnectAction.status}
								pendingLabel={t("disconnecting")}
							>
								Disconnect
							</AsyncButtonContent>
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
