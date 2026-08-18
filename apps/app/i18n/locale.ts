export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "openvz-crm-locale";

export const LOCALE_NAMES: Record<Locale, string> = {
	en: "English",
	zh: "中文",
};

export function isLocale(value: string | undefined | null): value is Locale {
	return (
		typeof value === "string" && (LOCALES as readonly string[]).includes(value)
	);
}

export function localeFromLanguages(header: string | null | undefined): Locale {
	if (!header) return DEFAULT_LOCALE;

	const ranked = header
		.split(",")
		.map((part) => {
			const [tag = "", ...parameters] = part.trim().split(";");
			const quality = parameters
				.map((parameter) => parameter.trim())
				.find((parameter) => parameter.startsWith("q="));

			return {
				tag: tag.trim().toLowerCase(),
				quality: quality ? Number(quality.slice(2)) : 1,
			};
		})
		.filter((entry) => entry.tag.length > 0 && !Number.isNaN(entry.quality))
		.sort((a, b) => b.quality - a.quality);

	for (const { tag } of ranked) {
		if (tag === "*") return DEFAULT_LOCALE;
		if (tag.startsWith("zh")) return "zh";
		if (tag.startsWith("en")) return "en";
	}

	return DEFAULT_LOCALE;
}
