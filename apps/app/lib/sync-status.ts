import type { GoogleSyncStatus } from "@openvz/db/enums";

export const SYNC_POLL_MS = 5_000;

export function isSyncing(status: GoogleSyncStatus | null): boolean {
	return status === "RUNNING";
}
