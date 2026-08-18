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

/**
 * The argument names a message takes. Only the outermost braces name an
 * argument — the ones inside a plural hold the words for each branch, and
 * those differ by language on purpose.
 */
function placeholders(value: string): string[] {
	const names: string[] = [];
	let depth = 0;

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];

		if (character === "}") {
			depth = Math.max(0, depth - 1);
			continue;
		}

		if (character !== "{") continue;

		depth += 1;
		if (depth !== 1) continue;

		const name = /^\s*(\w+)\s*[,}]/.exec(value.slice(index + 1))?.[1];
		if (name && !/^\d+$/.test(name)) names.push(name);
	}

	return [...new Set(names)].sort();
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

	it("never invent a value the message does not take", () => {
		const english = flatten(en as Tree);
		const chinese = flatten(zh as Tree);

		for (const [key, value] of english) {
			const offered = placeholders(value);
			const used = placeholders(chinese.get(key) ?? "");

			// A translation may ignore one — Chinese does not inflect for number,
			// so it has no use for a count the English needs for "is" and "are".
			expect(used.filter((name) => !offered.includes(name))).toEqual([]);
		}
	});

	it("is actually translated", () => {
		// Brand names are spelled the same in both languages. Every other
		// identical string is a key somebody forgot.
		const brands = new Set([
			"crm.contact.github",
			"settings.connections.google",
			"settings.connections.slack",
			"settings.connections.microsoft",
		]);

		const english = flatten(en as Tree);
		const chinese = flatten(zh as Tree);

		const untranslated = [...english]
			.filter(([key]) => !brands.has(key))
			.filter(([key, value]) => chinese.get(key) === value)
			.filter(([, value]) => /[A-Za-z]{4}/.test(value))
			.map(([key]) => key);

		expect(untranslated).toEqual([]);
	});
});
