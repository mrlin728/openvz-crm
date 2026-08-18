import type { MailboxProviderId } from "@openvz/auth/scopes";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { PasswordSignIn } from "./password-sign-in";
import { SocialSignIn } from "./social-sign-in";
import { type SsoProvider, SsoSignIn } from "./sso-sign-in";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("signIn");
	return { title: t("metaTitle") };
}

type SignInOptions = {
	password: boolean;
	firstRun: boolean;
	google: boolean;
	microsoft: boolean;
	providers: SsoProvider[];
};

async function signInOptions(): Promise<SignInOptions | null> {
	try {
		return await getServerQueryClient().fetchQuery(
			getServerTrpc().sso.signInOptions.queryOptions(),
		);
	} catch (error) {
		unstable_rethrow(error);
		console.error("Sign-in: could not read the sign-in options.", error);
		return null;
	}
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
	return (
		<AuthShell>
			<Suspense fallback={null}>
				<SignIn searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}

async function SignIn({
	searchParams,
}: Pick<PageProps<"/sign-in">, "searchParams">) {
	const t = await getTranslations("signIn");

	const [session, options, { method }] = await Promise.all([
		getSession().catch((error: unknown) => {
			unstable_rethrow(error);
			console.error("Sign-in: could not read the session.", error);
			return null;
		}),
		signInOptions(),
		searchParams,
	]);

	if (session) {
		redirect("/");
	}

	const configured: MailboxProviderId[] = [];
	if (options?.google ?? true) configured.push("google");
	if (options?.microsoft ?? false) configured.push("microsoft");

	const providers = options?.providers ?? [];

	const insisted = configured.find((provider) => provider === method);
	const showSso = providers.length > 0 && insisted === undefined;
	const social =
		insisted !== undefined
			? [insisted]
			: providers.length === 0
				? configured
				: [];

	const password = (options?.password ?? false) && insisted === undefined;
	const firstRun = password && (options?.firstRun ?? false);

	if (!showSso && social.length === 0 && !password) {
		return (
			<>
				<AuthHeading
					title={t("closedTitle")}
					description={t("closedDescription")}
				/>

				<p className="text-center text-muted-foreground text-sm/5">
					{t("closedHelp")}
				</p>
			</>
		);
	}

	return (
		<>
			<AuthHeading
				description={t(firstRun ? "firstRunDescription" : "welcomeDescription")}
				title={t(firstRun ? "firstRunTitle" : "welcomeTitle")}
			/>

			{password ? <PasswordSignIn create={firstRun} /> : null}
			{showSso ? <SsoSignIn providers={providers} /> : null}
			{social.map((provider) => (
				<SocialSignIn key={provider} provider={provider} />
			))}
		</>
	);
}
