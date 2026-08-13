/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

/**
 * @module context/body
 */

import type { Context } from "./core.ts";

export interface BodyReader {
	/**
	 * returns the body as a string. Uses cached JSON if already
	 * parsed to avoid re-reading the consumed request stream
	 */
	plain(): Promise<string>;

	/** returns the body as a parsed JSON object, using the cache if present */
	json<T = any>(): Promise<T>;
}

export function createBodyReader(ctx: Context<any>): BodyReader {
	return {
		plain: async () => {
			if (ctx.bodyCache) {
				return typeof ctx.bodyCache === "object" && ctx.bodyCache !== null
					? JSON.stringify(ctx.bodyCache)
					: String(ctx.bodyCache);
			}
			return await ctx.request.text();
		},
		json: async <T = any>() => (ctx.bodyCache as T) ?? await ctx.request.json(),
	};
}
