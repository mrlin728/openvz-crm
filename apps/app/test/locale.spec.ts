import { describe, expect, it } from "bun:test";
import { DEFAULT_LOCALE, isLocale, localeFromLanguages } from "../i18n/locale";

describe("which language a copy opens in", () => {
	it("reads the browser's first choice", () => {
		expect(localeFromLanguages("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
		expect(localeFromLanguages("en-GB,en;q=0.9")).toBe("en");
	});

	it("respects quality over order", () => {
		expect(localeFromLanguages("en;q=0.2,zh;q=0.9")).toBe("zh");
	});

	it("takes any Chinese variant", () => {
		for (const tag of ["zh", "zh-TW", "zh-Hans-CN", "ZH-HK"]) {
			expect(localeFromLanguages(tag)).toBe("zh");
		}
	});

	it("falls back to English for a language we do not speak", () => {
		expect(localeFromLanguages("fr-FR,fr;q=0.9")).toBe(DEFAULT_LOCALE);
		expect(localeFromLanguages("*")).toBe(DEFAULT_LOCALE);
		expect(localeFromLanguages(null)).toBe(DEFAULT_LOCALE);
		expect(localeFromLanguages("")).toBe(DEFAULT_LOCALE);
	});

	it("only accepts a locale it has messages for", () => {
		expect(isLocale("zh")).toBe(true);
		expect(isLocale("en")).toBe(true);
		expect(isLocale("de")).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});
