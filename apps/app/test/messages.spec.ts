import { describe, expect, it } from "bun:test";
import en from "../messages/en.json";
import zh from "../messages/zh.json";

type Tree = { [key: string]: string | Tree };

function paths(tree: Tree, prefix = ""): string[] {
	return Object.entries(tree).flatMap(([key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return typeof value === "string" ? [path] : paths(value, path);
	});
}

function placeholders(value: string): string[] {
	const named = [...value.matchAll(/\{\s*(\w+)\s*[,}]/g)]
		.map((match) => match[1] ?? "")
		.filter((name) => !/^\d+$/.test(name));

	return [...new Set(named)].sort();
}

function flatten(tree: Tree, prefix = ""): Map<string, string> {
	const flat = new Map<string, string>();

	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") flat.set(path, value);
		else for (const [k, v] of flatten(value, path)) flat.set(k, v);
	}

	return flat;
}

describe("the two catalogues", () => {
	it("say the same things", () => {
		const english = paths(en as Tree).sort();
		const chinese = paths(zh as Tree).sort();

		expect(chinese).toEqual(english);
	});

	it("take the same values", () => {
		const english = flatten(en as Tree);
		const chinese = flatten(zh as Tree);

		for (const [key, value] of english) {
			expect(placeholders(chinese.get(key) ?? "")).toEqual(placeholders(value));
		}
	});

	it("is actually translated", () => {
		const english = flatten(en as Tree);
		const chinese = flatten(zh as Tree);

		const untranslated = [...english]
			.filter(([key, value]) => chinese.get(key) === value)
			.filter(([, value]) => /[A-Za-z]{4}/.test(value))
			.map(([key]) => key);

		expect(untranslated).toEqual([]);
	});
});
