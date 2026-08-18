"use client";

import Launch from "@carbon/icons-react/es/Launch";
import Warning from "@carbon/icons-react/es/Warning";
import { authClient } from "@openvz/auth/client";
import { SYNC_SCOPES } from "@openvz/auth/scopes";
import {
	Alert,
	AlertAction,
	AlertDescription,
	AlertTitle,
} from "@openvz/ui/components/alert";
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
import GoogleLogo from "@openvz/ui/components/brand-logos/google";
import { Button } from "@openvz/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@openvz/ui/components/card";
import { Icon } from "@openvz/ui/components/icon";
import { Label } from "@openvz/ui/components/label";
import { Spinner } from "@openvz/ui/components/spinner";
import { StatusIndicator } from "@openvz/ui/components/status-indicator";
import { Switch } from "@openvz/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { LocalRelativeTime } from "@/components/local-date-time";
import { isSyncing, SYNC_POLL_MS } from "@/lib/sync-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const SOURCES = {
	calendar: {
		labelKey: "meetings",
		autoCreateKey: "autoCreateMeeting",
	},
	gmail: {
		labelKey: "email",
		autoCreateKey: "autoCreateEmail",
	},
} as const;

const RESOLVE_HOSTS = [
	"console.cloud.google.com",
	"console.developers.google.com",
	"support.google.com",
	"myaccount.google.com",
];

function resolveLink(error: string): string | undefined {
	const found = error.match(/https?:\/\/[^\s)]+/)?.[0];
	if (!found) return undefined;

	try {
		const url = new URL(found);
		const allowed =
			url.protocol === "https:" &&
			RESOLVE_HOSTS.some(
				(host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
			);
		return allowed ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

function explain(error: string) {
	return {
		summary: error.split(/(?<=\.)\s/)[0] ?? error,
		url: resolveLink(error),
	};
}

function failureSignature(
	sources: readonly {
		source: string;
		status: string | null;
		lastError: string | null;
	}[],
): string {
	const failures: string[] = [];
	for (const source of sources) {
		if (source.status === "NEEDS_RECONNECT" || source.lastError) {
			failures.push(`${source.source}:${source.lastError ?? "reconnect"}`);
		}
	}
	return failures.sort().join("|");
}

function GoogleUnavailable() {
	const t = useTranslations("settings.google");

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Google
						<StatusIndicator
							size="sm"
							tone="neutral"
							label={t("notConfigured")}
						/>
					</div>
				</CardTitle>
				<CardDescription>
					Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the root .env file
					and restart.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

const CONNECT_ERROR_KEYS: Record<string, string> = {
	"email_doesn't_match": "wrongAccount",
};

function ConnectGoogle({
	slug,
	connectError,
}: {
	slug: string;
	connectError?: string;
}) {
	const t = useTranslations("settings.google");
	const [pending, setPending] = useState(false);

	function fail(message?: string) {
		setPending(false);
		toast.error(message ?? t("unreachable"));
	}

	async function handleConnect() {
		setPending(true);

		const origin = window.location.origin;

		const { error } = await authClient.linkSocial({
			provider: "google",
			scopes: [...SYNC_SCOPES],
			callbackURL: `${origin}/${slug}/settings/connections/google`,
			errorCallbackURL: `${origin}/${slug}/settings/connections/google?provider=google`,
		});

		if (error) fail(error.message);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Google
						<StatusIndicator
							size="sm"
							tone="neutral"
							label={t("notConnected")}
						/>
					</div>
				</CardTitle>
				<CardDescription>{t("description")}</CardDescription>

				<CardAction>
					<Button
						size="sm"
						disabled={pending}
						onClick={() => {
							handleConnect().catch(() => fail());
						}}
						type="button"
					>
						{pending ? (
							<Spinner data-icon="inline-start" />
						) : (
							<GoogleLogo data-icon="inline-start" className="size-4" />
						)}
						Connect
					</Button>
				</CardAction>
			</CardHeader>

			{connectError ? (
				<CardContent>
					<Alert variant="destructive">
						<Icon icon={Warning} />
						<AlertTitle>{t("didNotFinish")}</AlertTitle>
						<AlertDescription>
							{connectError && CONNECT_ERROR_KEYS[connectError]
								? t(CONNECT_ERROR_KEYS[connectError])
								: t("returnedError")}
						</AlertDescription>
					</Alert>
				</CardContent>
			) : null}
		</Card>
	);
}

export function GoogleConnection({
	slug,
	connectError,
}: {
	slug: string;
	connectError?: string;
}) {
	const t = useTranslations("settings.google");
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();

	const status = useQuery({
		...trpc.google.status.queryOptions(),
		refetchInterval: (query) =>
			query.state.data?.sources.some((source) => isSyncing(source.status))
				? SYNC_POLL_MS
				: false,
	});

	const purge = useMutation(
		trpc.google.purgeSyncedData.mutationOptions({
			onSuccess: async (result) => {
				await cache.google();
				toast.success(t("purged", { count: result.purged }));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const revoke = useMutation(
		trpc.google.revokeAccess.mutationOptions({
			onSuccess: () =>
				window.location.assign(
					status.data?.required ? "/" : `/${slug}/settings/connections`,
				),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setAutoCreate = useMutation(
		trpc.google.setAutoCreate.mutationOptions({
			onSuccess: () => cache.google({ settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const [insistence, setInsistence] = useState(0);

	const syncNow = useMutation(
		trpc.google.syncNow.mutationOptions({
			onSuccess: async () => {
				const before = failureSignature(status.data?.sources ?? []);
				await cache.google();

				const after = failureSignature(
					queryClient.getQueryData(trpc.google.status.queryKey())?.sources ??
						[],
				);

				if (after && after === before) setInsistence((count) => count + 1);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!status.data) return null;

	const { sources, hasRefreshToken, configured, linked, required } =
		status.data;

	if (!configured) return <GoogleUnavailable />;
	if (!linked) return <ConnectGoogle slug={slug} connectError={connectError} />;

	const failing = sources.filter(
		(source) => source.status === "NEEDS_RECONNECT" || source.lastError,
	);
	const lastSyncedAt = sources
		.map((source) => source.lastSyncedAt)
		.filter((at): at is string => at !== null)
		.sort()
		.at(-1);

	const healthy = failing.length === 0 && hasRefreshToken;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<div className="flex items-center gap-2">
						Google
						<StatusIndicator
							size="sm"
							tone={healthy ? "success" : "warning"}
							label={t(healthy ? "connected" : "needsAttention")}
						/>
					</div>
				</CardTitle>
				<CardDescription>
					Meetings and email threads land on the matching company as they
					happen.
				</CardDescription>

				<CardAction>
					<Button
						variant="contrast"
						size="sm"
						disabled={syncNow.isPending}
						onClick={() => syncNow.mutate()}
					>
						{t(syncNow.isPending ? "checking" : "checkNow")}
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				{!hasRefreshToken ? (
					<Alert variant="destructive" attention={insistence}>
						<Icon icon={Warning} />
						<AlertTitle>{t("noRefreshToken")}</AlertTitle>
						<AlertDescription>{t("signOutAndIn")}</AlertDescription>
					</Alert>
				) : failing.length > 0 ? (
					failing.map((source) => {
						const { summary, url } = explain(
							source.lastError ?? t("needsReconnect"),
						);

						return (
							<Alert
								key={source.source}
								variant="destructive"
								attention={insistence}
							>
								<Icon icon={Warning} />
								<AlertTitle>
									{t("syncFailed", {
										source: t(SOURCES[source.source].labelKey),
									})}
								</AlertTitle>
								<AlertDescription>{summary}</AlertDescription>

								{url ? (
									<AlertAction>
										<Button variant="contrast" size="xs" asChild>
											<a href={url} target="_blank" rel="noreferrer">
												Resolve
												<Icon icon={Launch} data-icon="inline-end" />
											</a>
										</Button>
									</AlertAction>
								) : null}
							</Alert>
						);
					})
				) : (
					<p className="text-muted-foreground text-xs">
						{lastSyncedAt ? (
							<>
								Last checked <LocalRelativeTime date={lastSyncedAt} />
							</>
						) : (
							t("waitingFirstCheck")
						)}
					</p>
				)}

				{sources.map((source) => {
					const copy = SOURCES[source.source];

					return (
						<div
							key={source.source}
							className="flex items-center justify-between gap-6"
						>
							<Label
								htmlFor={`auto-create-${source.source}`}
								className="flex flex-col items-start gap-1"
							>
								<span className="text-sm">{t(copy.labelKey)}</span>
								<span className="font-normal text-muted-foreground text-xs">
									{t(copy.autoCreateKey)}
								</span>
							</Label>

							<Switch
								id={`auto-create-${source.source}`}
								checked={source.autoCreate}
								disabled={setAutoCreate.isPending}
								onCheckedChange={(enabled) =>
									setAutoCreate.mutate({ source: source.source, enabled })
								}
							/>
						</div>
					);
				})}

				<CardFooter>
					<div className="-ml-2 flex flex-wrap items-center gap-1 text-muted-foreground">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="ghost" size="xs" disabled={purge.isPending}>
									{t("deleteSynced")}
								</Button>
							</AlertDialogTrigger>

							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t("deleteSyncedTitle")}</AlertDialogTitle>
									<AlertDialogDescription>
										{t("deleteSyncedDescription")}
									</AlertDialogDescription>
								</AlertDialogHeader>

								<AlertDialogFooter>
									<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
									<AlertDialogAction
										variant="destructive"
										onClick={() => purge.mutate()}
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>

						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="ghost" size="xs" disabled={revoke.isPending}>
									{t("revoke")}
								</Button>
							</AlertDialogTrigger>

							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
									<AlertDialogDescription>
										{required ? t("revokeRequired") : t("revokeOptional")}
									</AlertDialogDescription>
								</AlertDialogHeader>

								<AlertDialogFooter>
									<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
									<AlertDialogAction
										variant="destructive"
										onClick={() => revoke.mutate()}
									>
										Revoke
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>

						<Button variant="ghost" size="xs" asChild>
							<Link
								href="https://myaccount.google.com/permissions"
								target="_blank"
								rel="noreferrer"
							>
								Manage in your Google account
							</Link>
						</Button>
					</div>
				</CardFooter>
			</CardContent>
		</Card>
	);
}
