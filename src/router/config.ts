/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { ErrorHandler, Handler } from "../context/middleware.ts";
import type { ReplaceReturnType } from "../types.ts";
import { log } from "@july/snarl/verbosity";

export interface RouterConfig {
	prefix: string;
	onError: ErrorHandler;
	onNotFound: ReplaceReturnType<Handler<Record<PropertyKey, never>>, Response | Promise<Response>>;
	onListen?: Parameters<typeof Deno.serve>[0]["onListen"];

	/**
	 * match path segments case-sensitively. defaults to `true`.
	 * e.g. `/Users` and `/users` are treated as distinct routes when enabled.
	 */
	caseSensitive: boolean;

	/**
	 * strategy for a request path that only differs from a registered route
	 * by a trailing slash:
	 * - `"lenient"` (default): `/users` and `/users/` both match
	 * - `"strict"`: only the exact registered form matches; the other 404s
	 * - `"redirect"`: 308-redirect to the canonical (no trailing slash) form
	 */
	trailingSlash: "lenient" | "strict" | "redirect";
}

function defaultOnError(): ErrorHandler {
	return (error, ctx) => (
		log.error("router", "route error", error),
			ctx.json({ error: "Internal Server Error", message: error.message }, { status: 500 })
	);
}

function defaultOnNotFound(): RouterConfig["onNotFound"] {
	return (ctx) => ctx.json({ error: "Not Found", path: ctx.path }, { status: 404 });
}

export function resolveRouterConfig(partial: Partial<RouterConfig> = {}): RouterConfig {
	return {
		prefix: partial.prefix ?? "",
		onError: partial.onError ?? defaultOnError(),
		onNotFound: partial.onNotFound ?? defaultOnNotFound(),
		onListen: partial.onListen,
		caseSensitive: partial.caseSensitive ?? true,
		trailingSlash: partial.trailingSlash ?? "lenient",
	};
}
