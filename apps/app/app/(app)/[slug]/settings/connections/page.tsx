import GoogleLogo from "@openvz/ui/components/brand-logos/google";
import MicrosoftLogo from "@openvz/ui/components/brand-logos/microsoft";
import SlackLogo from "@openvz/ui/components/brand-logos/slack";
import { Button } from "@openvz/ui/components/button";
import { Spinner } from "@openvz/ui/components/spinner";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { AddConnectionDialog } from "./add-connection-dialog";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings.connections");
	return { title: t("title") };
}

export default function ConnectionsSettingsPage(
	props: PageProps<"/[slug]/settings/connections">,
) {
	return (
		<Suspense fallback={<ConnectionsFallback />}>
			<ConnectionsSettingsPageContent {...props} />
		</Suspense>
	);
}

async function ConnectionsSettingsPageContent({
	params,
	searchParams,
}: PageProps<"/[slug]/settings/connections">) {
	await requireSession();
	const t = await getTranslations("settings.connections");
	const [{ slug }, query] = await Promise.all([params, searchParams]);
	const queryClient = getServerQueryClient();
	const trpc = getServerTrpc();
	const [google, microsoft, slack] = await Promise.all([
		queryClient.fetchQuery(trpc.google.status.queryOptions()),
		queryClient.fetchQuery(trpc.microsoft.status.queryOptions()),
		queryClient.fetchQuery(trpc.slack.status.queryOptions()),
	]);
	const rows = [
		...(google.linked
			? [
					{
						id: "google",
						name: t("google"),
						status: t("connected"),
						bringsIn: t("googleBringsIn"),
						sends: t("nothingYet"),
						href: `/${slug}/settings/connections/google`,
						logo: GoogleLogo,
					},
				]
			: []),
		...(slack.connected
			? [
					{
						id: "slack",
						name: t("slack"),
						status: slack.workspace
							? t("connectedTo", { workspace: slack.workspace })
							: t("connected"),
						bringsIn: t("slackBringsIn"),
						sends: t("slackSends"),
						href: `/${slug}/settings/connections/slack`,
						logo: SlackLogo,
					},
				]
			: []),
		...(microsoft.linked
			? [
					{
						id: "microsoft",
						name: t("microsoft"),
						status: t("connected"),
						bringsIn: t("microsoftBringsIn"),
						sends: t("nothingYet"),
						href: `/${slug}/settings/connections/microsoft`,
						logo: MicrosoftLogo,
					},
				]
			: []),
	];

	return (
		<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-(--spacing-page-inline) pt-(--spacing-page-top) pb-(--spacing-page-bottom)">
			{rows.length > 0 ? (
				<div className="mx-auto flex w-full max-w-(--container-page) flex-col gap-(--spacing-page-gap)">
					<header className="flex items-start justify-between gap-4 px-(--spacing-block-inline)">
						<div className="flex flex-col gap-2">
							<h1 className="font-medium text-2xl tracking-tight">
								{t("title")}
							</h1>
							<p className="max-w-2xl text-muted-foreground text-sm">
								{t("pageDescription")}
							</p>
						</div>
						<Button asChild variant="outline">
							<Link href={`/${slug}/settings/connections?add=1`}>
								{t("addConnection")}
							</Link>
						</Button>
					</header>
					<div className="flex flex-col gap-3">
						{rows.map((row) => (
							<ConnectionCard key={row.id} t={t} {...row} />
						))}
					</div>
				</div>
			) : (
				<div className="mx-auto flex w-full max-w-(--container-narrow) flex-1 flex-col justify-center gap-(--spacing-page-gap) text-center">
					<div className="flex flex-col gap-2 px-(--spacing-block-inline)">
						<h1 className="font-medium text-2xl tracking-tight">
							{t("noneYet")}
						</h1>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{t("emptyPrompt")}
						</p>
					</div>
					<div className="flex flex-col divide-y rounded-lg border bg-card px-(--spacing-block-inline)">
						<StarterRow
							t={t}
							logo={GoogleLogo}
							name={t("google")}
							description={t("googleTeaser")}
							href={`/${slug}/settings/connections/google`}
						/>
						<StarterRow
							t={t}
							logo={SlackLogo}
							name={t("slack")}
							description={t("slackTeaser")}
							href={`/${slug}/settings/connections/slack`}
						/>
						<StarterRow
							t={t}
							logo={MicrosoftLogo}
							name={t("microsoft")}
							description={t("microsoftTeaser")}
							href={`/${slug}/settings/connections/microsoft`}
						/>
					</div>
					<p className="px-(--spacing-block-inline) text-muted-foreground text-sm">
						Looking for something else?{" "}
						<Link
							className="font-medium text-foreground underline underline-offset-4"
							href={`/${slug}/settings/connections?add=1`}
						>
							{t("browseAll")}
						</Link>
					</p>
				</div>
			)}
			<AddConnectionDialog
				slug={slug}
				open={first(query.add) === "1"}
				connected={rows.map((row) => row.id)}
			/>
		</main>
	);
}

function ConnectionsFallback() {
	return (
		<main className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-(--spacing-page-inline) pt-(--spacing-page-top) pb-(--spacing-page-bottom)">
			<Spinner size="lg" />
		</main>
	);
}

function ConnectionCard({
	name,
	status,
	bringsIn,
	sends,
	href,
	logo: Logo,
	t,
}: {
	t: (key: string) => string;
	name: string;
	status: string;
	bringsIn: string;
	sends: string;
	href: string;
	logo: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
	return (
		<section className="flex flex-col gap-4 rounded-lg border bg-card px-(--spacing-block-inline) py-4">
			<div className="flex items-center gap-3">
				<Logo className="size-5 shrink-0" />
				<h2 className="font-medium text-sm">{name}</h2>
				<p className="ml-auto text-right text-muted-foreground text-xs">
					{status}
				</p>
				<Button asChild size="sm" variant="outline">
					<Link href={href}>{t("manage")}</Link>
				</Button>
			</div>
			<div className="flex flex-col gap-2 pl-8 text-sm">
				<CapabilityRow label={t("bringsIn")} value={bringsIn} />
				<CapabilityRow label={t("sends")} value={sends} />
			</div>
		</section>
	);
}

function CapabilityRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex gap-4">
			<span className="w-22 shrink-0 text-muted-foreground">{label}</span>
			<span>{value}</span>
		</div>
	);
}

function StarterRow({
	logo: Logo,
	name,
	description,
	href,
	t,
}: {
	logo: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	name: string;
	description: string;
	href: string;
	t: (key: string) => string;
}) {
	return (
		<div className="flex items-center gap-3 py-4 text-left">
			<Logo className="size-5 shrink-0" />
			<div className="min-w-0 flex-1">
				<h2 className="font-medium text-sm">{name}</h2>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			<Button asChild variant="outline" size="sm">
				<Link href={href}>{t("connect")}</Link>
			</Button>
		</div>
	);
}

function first(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}
