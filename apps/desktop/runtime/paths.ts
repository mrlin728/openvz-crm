import { homedir } from "node:os";
import { join } from "node:path";

export function crmHome(): string {
	const override = process.env.OPENVZ_CRM_HOME;
	if (override && override.length > 0) return override;

	if (process.platform === "darwin") {
		return join(homedir(), "Library", "Application Support", "OPENVZ CRM");
	}

	if (process.platform === "win32") {
		const appData =
			process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
		return join(appData, "OPENVZ CRM");
	}

	const xdg = process.env.XDG_DATA_HOME;
	const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "share");
	return join(base, "openvz-crm");
}

export interface Layout {
	home: string;
	clusterData: string;
	runtime: string;
	runtimeStamp: string;
	logs: string;
	secrets: string;
	state: string;
}

export function layout(home = crmHome()): Layout {
	return {
		home,
		clusterData: join(home, "postgres", "data"),
		runtime: join(home, "runtime"),
		runtimeStamp: join(home, "runtime", ".payload-version"),
		logs: join(home, "logs"),
		secrets: join(home, "secrets.json"),
		state: join(home, "state.json"),
	};
}
