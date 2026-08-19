import { DEFAULT_WORKSPACE_NAME } from "@openvz/auth";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
	title: "Set up",
};

export const instant = false;

export default async function OnboardingPage() {
	const t = await getTranslations("onboarding");
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading title={t("title")} description={t("description")} />

			<OnboardingForm placeholder={DEFAULT_WORKSPACE_NAME} />
		</AuthShell>
	);
}
