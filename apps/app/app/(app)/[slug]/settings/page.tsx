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
import { AgentModel } from "./agent-model";
import { LanguageForm } from "./language-form";
import { ResearchKey } from "./research-key";
import { WorkspaceForm } from "./workspace-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings.general");
	return { title: t("title") };
}

export default function GeneralSettingsPage() {
	const t = useTranslations("settings.general");

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{t("title")}</PageShellTitle>
					<PageShellDescription>{t("description")}</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Settings />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Settings() {
	await requireSession();

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(trpc.workspace.get.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.agentModel.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.modelCatalog.queryOptions()),
		queryClient.prefetchQuery(trpc.settings.researchKey.queryOptions()),
	]);

	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<WorkspaceForm />
				<LanguageForm />
				<ResearchKey />
				<AgentModel />
			</div>
		</HydrateClient>
	);
}
