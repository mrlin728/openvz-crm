import { db } from "@openvz/db";
import { readAgentModel } from "@openvz/db/settings";

export interface ModelSelection {
	model: string;
	modelContextWindowTokens: number;
}

export async function selectedModel(): Promise<ModelSelection | null> {
	try {
		const setting = await readAgentModel(db);

		if (setting.isDefault) return null;

		return {
			model: setting.id,
			modelContextWindowTokens: setting.contextWindowTokens,
		};
	} catch (error) {
		console.error(
			`[agent] could not read the configured model, falling back: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return null;
	}
}
