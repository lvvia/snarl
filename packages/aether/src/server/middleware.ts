/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { type Context, type Middleware, MutableResponse, provideMiddleware } from "@july/snarl";
import { type AetherServeOptions, bundleIslands, encodeEntryKey } from "./bundler.ts";
import { discoverAndRegisterIslands } from "./discover.ts";
import { getUsedIslands } from "./registry.ts";

const BUNDLE_CACHE = new Map<string, string>();

function decodeEntryKey(key: string): string[] {
	return key.length === 0 ? [] : key.split(",").map(decodeURIComponent);
}

export interface AetherOptions extends AetherServeOptions {
	/** directories or files to analyse for interactive components */
	entrypoints?: string[];
}

async function injectIslandScript(
	response: MutableResponse,
	ctx: Context,
): Promise<MutableResponse> {
	const contentType = response.headers.get("Content-Type") ?? "";
	if (!contentType.includes("text/html")) return response;

	const used = getUsedIslands(ctx);
	if (!used || used.size === 0) return response;

	const key = encodeEntryKey(used);
	const src = `/_aether/entry/${key}.js`;

	const html = await response.text();
	if (!html || html.includes(src)) return response;

	const script = `<script type="module" src="${src}"></script>`;

	let injected: string;
	if (html.includes("</body>")) {
		injected = html.replace("</body>", `${script}</body>`);
	} else if (html.includes("</html>")) {
		injected = html.replace("</html>", `${script}</html>`);
	} else {
		injected = html + script;
	}

	const headers = new Headers(response.headers);
	headers.delete("Content-Length");

	return new MutableResponse(injected, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function aether(options: AetherOptions = {}): Middleware {
	const cache = options.cache ?? BUNDLE_CACHE;

	const ready = options.entrypoints
		? discoverAndRegisterIslands(options.entrypoints)
		: Promise.resolve();

	return async (ctx, next) => {
		await ready;
		const { pathname } = ctx.url;

		if (pathname.startsWith("/_aether/entry/")) {
			let key = pathname.slice(15);

			if (key.endsWith(".js")) {
				key = key.slice(0, -3);
			}

			const names = decodeEntryKey(key);
			const cacheKey = names.join(",");

			let code = cache.get(cacheKey);
			if (!code) {
				code = await bundleIslands(names, options);
				cache.set(cacheKey, code);
			}

			return new Response(code, {
				headers: {
					"Content-Type": "application/javascript; charset=utf-8",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		}

		const response = await next();
		return injectIslandScript(response, ctx);
	};
}

provideMiddleware({
	name: "aether",
	priority: 800,
	dependencies: ["context"],
	factory: () => aether(),
});
