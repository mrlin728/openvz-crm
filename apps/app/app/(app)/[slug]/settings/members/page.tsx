import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { membersSearchParams } from "./members-search-params";
import { MembersTable } from "./members-table";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings.members");
	return { title: t("title") };
}

export default function MembersSettingsPage({
	searchParams,
}: PageProps<"/[slug]/settings/members">) {
	const t = useTranslations("settings.members");

	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{t("title")}</PageShellTitle>
					<PageShellDescription>{t("description")}</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Members searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Members({
	searchParams,
}: Pick<PageProps<"/[slug]/settings/members">, "searchParams">) {
	await requireSession();

	const values = await membersSearchParams.load(searchParams);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
		queryClient.prefetchQuery(
			trpc.workspace.members.queryOptions(membersSearchParams.toInput(values)),
		),
	]);

	return (
		<HydrateClient>
			<MembersTable />
		</HydrateClient>
	);
}
