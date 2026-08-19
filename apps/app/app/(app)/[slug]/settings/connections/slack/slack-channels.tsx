"use client";
import Search from "@carbon/icons-react/es/Search";
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
import { Icon } from "@openvz/ui/components/icon";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@openvz/ui/components/input-group";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import {
	ChannelPicker,
	type PickerChannel,
} from "@/components/slack/channel-picker";
import { useSlackChannels } from "@/components/slack/use-slack-channels";
import { useTRPC } from "@/lib/trpc/client";

const INVITE_COMMAND = "/invite @OPENVZ AI";

export function SlackChannels() {
	const t = useTranslations("settings.slack");
	const trpc = useTRPC();
	const [asking, setAsking] = useState<PickerChannel | null>(null);
	const [query, setQuery] = useState("");
	const search = useDeferredValue(query);
	const channels = useSlackChannels({ query: search });
	const join = useMutation(
		trpc.slack.joinChannel.mutationOptions({
			onSuccess: async (result) => {
				await channels.reload();
				setAsking(null);
				toast.success(
					result.alreadyJoined
						? t("alreadyIn")
						: result.queued
							? t("joining")
							: t("askInvite"),
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const joinAction = useAsyncAction({
		action: async (channelId: string) => join.mutateAsync({ channelId }),
	});
	const refresh = useMutation(
		trpc.slack.refreshPeople.mutationOptions({
			onSuccess: async () => {
				toast.success(t("reading"));
				await channels.reload();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const refreshing = refresh.isPending || channels.syncing;
	const rows = channels.channels;
	const canInviteItself = channels.canInviteItself;

	return (
		<section className="flex flex-col gap-3 px-(--spacing-block-inline)">
			<div className="flex items-end justify-between gap-4">
				<div>
					<h2 className="font-medium text-sm">{t("channelsReachable")}</h2>
					<p className="text-muted-foreground text-xs">{t("agentsPickFrom")}</p>
				</div>
				<Button
					disabled={refreshing}
					onClick={() => refresh.mutate()}
					size="sm"
					variant="outline"
				>
					{t(refreshing ? "refreshing" : "refresh")}
				</Button>
			</div>

			{channels.stalled ? (
				<p className="text-warning text-xs">{t("notReadingList")}</p>
			) : null}

			{rows.length > 0 || query ? (
				<InputGroup>
					<InputGroupAddon>
						<Icon icon={Search} motion="none" className="size-4" />
					</InputGroupAddon>
					<InputGroupInput
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("searchChannels")}
						value={query}
					/>
				</InputGroup>
			) : null}

			<ChannelPicker
				canInviteItself={canInviteItself}
				channels={rows}
				empty={
					<p className="px-4 py-4 text-muted-foreground text-sm">
						{channels.pending
							? t("readingList")
							: query
								? `No channel matches “${query}”.`
								: t("noChannels")}
					</p>
				}
				onAdd={(channel) => void joinAction.run(channel.id)}
				onRequest={(channel) => setAsking(channel)}
				pending={joinAction.pending}
			/>

			{channels.hasMore ? (
				<Button
					disabled={channels.fetchingMore}
					onClick={channels.loadMore}
					size="sm"
					variant="outline"
				>
					{t(channels.fetchingMore ? "loading" : "loadMore")}
				</Button>
			) : null}

			<AskDialog
				canInviteItself={canInviteItself}
				channel={asking}
				onCancel={() => setAsking(null)}
				onConfirm={() => asking && void joinAction.run(asking.id)}
				status={joinAction.status}
			/>
		</section>
	);
}

function AskDialog({
	canInviteItself,
	channel,
	onCancel,
	onConfirm,
	status,
}: {
	canInviteItself: boolean;
	channel: PickerChannel | null;
	onCancel: () => void;
	onConfirm: () => void;
	status: "idle" | "pending" | "success" | "error";
}) {
	const t = useTranslations("settings.slack");
	if (!channel) return null;

	async function copyThenConfirm() {
		try {
			await navigator.clipboard.writeText(INVITE_COMMAND);
		} catch {
			toast.error(t("copyFailed"));
			return;
		}

		toast.success(t("copied"));
		onConfirm();
	}

	return (
		<AlertDialog open onOpenChange={(open) => !open && onCancel()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{canInviteItself
							? `Add OPENVZ AI to #${channel.name}?`
							: t("askSomeone")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{canInviteItself
							? `It is a private channel, so OPENVZ AI joins as you. Same as typing the invite yourself. Everyone in the channel sees it join. It reads nothing until you turn a permission on.`
							: `We cannot add OPENVZ AI to a private channel yet. Someone already in #${channel.name} has to run this.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{canInviteItself ? null : (
					<div className="rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
						{INVITE_COMMAND}
					</div>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={status === "pending"}>
						{t("cancel")}
					</AlertDialogCancel>
					<Button
						disabled={status === "pending"}
						onClick={canInviteItself ? onConfirm : () => void copyThenConfirm()}
					>
						<AsyncButtonContent pendingLabel={t("adding")} status={status}>
							{canInviteItself ? "Add OPENVZ AI" : "Copy and mark as asked"}
						</AsyncButtonContent>
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
