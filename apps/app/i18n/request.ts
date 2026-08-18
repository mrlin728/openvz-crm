import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
	isLocale,
	LOCALE_COOKIE,
	type Locale,
	localeFromLanguages,
} from "./locale";

async function resolveLocale(): Promise<Locale> {
	const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
	if (isLocale(chosen)) return chosen;

	const accepted = (await headers()).get("accept-language");
	return localeFromLanguages(accepted);
}

export default getRequestConfig(async () => {
	const locale = await resolveLocale();

	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
		now: new Date(),
	};
});
