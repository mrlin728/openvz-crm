import { Button } from "@openvz/ui/components/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";

export default function IntakeConnectionPage(
	props: PageProps<"/[slug]/settings/connections/intake">,
) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<IntakeConnectionPageContent {...props} />
		</Suspense>
	);
}

async function IntakeConnectionPageContent({
	params,
}: PageProps<"/[slug]/settings/connections/intake">) {
	const t = await getTranslations("settings.connections");
	await requireSession();
	const { slug } = await params;

	return (
		<ConnectionPage centered className="max-w-(--container-narrow) text-center">
			<header className="flex flex-col gap-3 px-(--spacing-block-inline)">
				<h1 className="font-medium text-2xl tracking-tight">
					{t("intakeTitle")}
				</h1>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{t("intakeUnavailableLong")}
				</p>
			</header>
			<div>
				<Button asChild variant="outline">
					<Link href={`/${slug}/settings/connections`}>
						{t("backToConnections")}
					</Link>
				</Button>
			</div>
		</ConnectionPage>
	);
}
