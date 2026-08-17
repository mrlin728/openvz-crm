import { AwsClient } from "aws4fetch";

export type R2Config = {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	publicBase: string;
};

export function r2Config(): R2Config | null {
	const accountId = process.env.R2_ACCOUNT_ID?.trim();
	const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
	const bucket = process.env.R2_BUCKET?.trim();
	const publicBase = process.env.R2_PUBLIC_BASE?.trim().replace(/\/$/, "");

	if (
		!accountId ||
		!accessKeyId ||
		!secretAccessKey ||
		!bucket ||
		!publicBase
	) {
		return null;
	}

	return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

let client: AwsClient | null = null;
let clientKey = "";

function aws(config: R2Config): AwsClient {
	if (client && clientKey === config.accessKeyId) return client;

	client = new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		service: "s3",
		region: "auto",
	});
	clientKey = config.accessKeyId;

	return client;
}

export function r2ObjectUrl(config: R2Config, key: string): string {
	const path = key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return `${config.publicBase}/${path}`;
}

export async function r2Put(
	config: R2Config,
	key: string,
	body: Buffer,
	contentType: string,
): Promise<string | null> {
	const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;

	try {
		const response = await aws(config).fetch(endpoint, {
			method: "PUT",
			body: new Uint8Array(body),
			headers: {
				"content-type": contentType,
				"content-length": String(body.byteLength),
				"cache-control": "public, max-age=31536000, immutable",
			},
		});

		if (!response.ok) return null;

		return r2ObjectUrl(config, key);
	} catch {
		return null;
	}
}
