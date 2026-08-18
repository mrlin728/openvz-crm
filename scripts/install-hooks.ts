import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
	stdio: "ignore",
});

if (result.error !== undefined || result.status !== 0) {
	console.log(
		"Git hooks are not installed: this is not a git checkout, or git is not on PATH.",
	);
}
