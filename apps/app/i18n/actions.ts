"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function chooseLocale(value: string): Promise<void> {
	if (!isLocale(value)) return;

	const locale: Locale = value;

	(await cookies()).set(LOCALE_COOKIE, locale, {
		maxAge: ONE_YEAR_SECONDS,
		path: "/",
		sameSite: "lax",
	});

	revalidatePath("/", "layout");
}
