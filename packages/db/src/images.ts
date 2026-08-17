export const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export const R2_HOST_SUFFIX = ".r2.dev";

export const MIRROR_HOST_SUFFIXES = [BLOB_HOST_SUFFIX, R2_HOST_SUFFIX] as const;

export const COMPANY_IMAGE_FIELDS = [
	"logoUrl",
	"logoDarkUrl",
	"iconUrl",
	"iconDarkUrl",
] as const;

export type CompanyImageField = (typeof COMPANY_IMAGE_FIELDS)[number];

const OPTIMIZABLE = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);

export function isMirrored(url: string | null | undefined): boolean {
	if (!url) return false;
	try {
		const { hostname } = new URL(url);
		return MIRROR_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
	} catch {
		return false;
	}
}

export function isOptimizable(url: string | null | undefined): boolean {
	if (!isMirrored(url) || !url) return false;

	try {
		const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
		return extension !== undefined && OPTIMIZABLE.has(extension);
	} catch {
		return false;
	}
}
