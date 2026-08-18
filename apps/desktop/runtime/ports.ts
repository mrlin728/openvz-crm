import { createServer } from "node:net";

export async function freePort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = createServer();

		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();

			if (address === null || typeof address === "string") {
				server.close();
				reject(new Error("The operating system gave no port."));
				return;
			}

			const { port } = address;
			server.close(() => resolve(port));
		});
	});
}

export async function freePorts(count: number): Promise<number[]> {
	const ports: number[] = [];

	while (ports.length < count) {
		const port = await freePort();
		if (!ports.includes(port)) ports.push(port);
	}

	return ports;
}

export async function isReachable(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(2000),
			redirect: "manual",
		});

		return response.status > 0;
	} catch {
		return false;
	}
}

export async function waitUntilReachable(
	url: string,
	timeoutMs: number,
	label: string,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (await isReachable(url)) return;
		await Bun.sleep(250);
	}

	throw new Error(`${label} did not answer at ${url} within ${timeoutMs}ms.`);
}
