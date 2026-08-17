import { createHash } from "node:crypto";
import { isMirrored } from "./images";
import { r2Config, r2Put } from "./r2";
import { safeFetch } from "./safe-fetch";

export { isMirrored, isOptimizable } from "./images";
export { r2Config } from "./r2";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

const ALLOWED: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/svg+xml": "svg",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};

export function vercelBlobEnabled(): boolean {
	return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function blobEnabled(): boolean {
	return r2Config() !== null || vercelBlobEnabled();
}

export function blobBackend(): "r2" | "vercel" | null {
	if (r2Config() !== null) return "r2";
	return vercelBlobEnabled() ? "vercel" : null;
}

export async function mirror(
	sourceUrl: string,
	prefix: string,
): Promise<string | null> {
	if (!blobEnabled()) return null;
	if (isMirrored(sourceUrl)) return sourceUrl;

	try {
		const result = await safeFetch(sourceUrl, { timeoutMs: TIMEOUT_MS });
		if (!result?.response.ok) return null;

		const { response } = result;
		const type = response.headers.get("content-type")?.split(";")[0]?.trim();
		const extension = type ? ALLOWED[type.toLowerCase()] : undefined;
		if (!type || !extension) return null;

		const bytes = await readCapped(response);
		if (!bytes) return null;

		const digest = createHash("sha256")
			.update(bytes)
			.digest("hex")
			.slice(0, 12);

		const name = `${prefix}-${digest}.${extension}`;

		const r2 = r2Config();
		if (r2) return await r2Put(r2, name, bytes, type);

		const { put } = await import("@vercel/blob");

		const blob = await put(name, bytes, {
			access: "public",
			contentType: type,
			addRandomSuffix: false,
			allowOverwrite: true,
		});

		return blob.url;
	} catch {
		return null;
	}
}

async function readCapped(response: Response): Promise<Buffer | null> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_BYTES) {
		await response.body?.cancel();
		return null;
	}

	if (!response.body) return null;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	try {
		while (size <= MAX_BYTES) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			chunks.push(value);
		}
	} catch {
		return null;
	} finally {
		await reader.cancel().catch(() => {});
	}

	if (size === 0 || size > MAX_BYTES) return null;
	return Buffer.concat(chunks);
}
