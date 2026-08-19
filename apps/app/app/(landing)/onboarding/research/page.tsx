import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = {
	title: "Research key",
};

export const instant = false;

export default async function ResearchKeyPage() {
	const t = await getTranslations("onboarding");
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title={t("researchTitle")}
				description={t("researchDescription")}
			/>

			<ResearchForm />
		</AuthShell>
	);
}
