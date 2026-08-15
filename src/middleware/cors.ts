/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Context } from "../context/core.ts";
import { type Middleware, MutableResponse } from "../context/middleware.ts";
import { httpMethods } from "../types.ts";
import { provideMiddleware } from "./manager.ts";

export type OriginFn = (
	origin: string | null,
	ctx: Context,
) => string | boolean | Promise<string | boolean>;

export interface CorsOptions {
	origin?: string | string[] | OriginFn;
	methods?: string[];
	headers?: string[];
	credentials?: boolean;
	maxAge?: number;
}

/**
 * Middleware to handle Cross-Origin Resource Sharing (CORS).
 * @example
 * ```ts
 * app.use(cors({ origin: "https://example.com", methods: ["GET", "POST"], credentials: true }));
 * ```
 */
export function cors(options: CorsOptions = {}): Middleware {
	const {
		origin = "*",
		methods = httpMethods,
		headers: allowedHeaders = ["*"],
		credentials = false,
		maxAge,
	} = options;

	const methodsHeader = methods.join(", ");
	const headersHeader = allowedHeaders.join(", ");

	return async (ctx, next) => {
		const preflight = ctx.request.method === "OPTIONS";
		const requestOrigin = ctx.request.headers.get("Origin");

		if (preflight) {
			const headers = new Headers();
			await applyOrigin(headers, requestOrigin, origin, ctx);

			headers.set("Access-Control-Allow-Methods", methodsHeader);
			headers.set("Access-Control-Allow-Headers", headersHeader);

			if (credentials) headers.set("Access-Control-Allow-Credentials", "true");
			if (maxAge) headers.set("Access-Control-Max-Age", maxAge.toString());

			return new MutableResponse(null, { status: 204, headers });
		}

		const state = await next();
		await applyOrigin(state.headers, requestOrigin, origin, ctx);
		state.headers.set("Access-Control-Allow-Methods", methodsHeader);
		state.headers.set("Access-Control-Allow-Headers", headersHeader);
		if (credentials) state.headers.set("Access-Control-Allow-Credentials", "true");

		return state;
	};
}

async function applyOrigin(
	headers: Headers,
	requestOrigin: string | null,
	origin: string | string[] | OriginFn,
	ctx: Context,
): Promise<void> {
	const appendVary = () => {
		const currentVary = headers.get("Vary");
		if (!currentVary) {
			headers.set("Vary", "Origin");
		} else if (!currentVary.split(",").map((v) => v.trim().toLowerCase()).includes("origin")) {
			headers.set("Vary", `${currentVary}, Origin`);
		}
	};

	if (typeof origin === "function") {
		appendVary();
		const result = await origin(requestOrigin, ctx);
		if (typeof result === "string") {
			headers.set("Access-Control-Allow-Origin", result);
		} else if (result && requestOrigin) {
			headers.set("Access-Control-Allow-Origin", requestOrigin);
		}
		return;
	}

	if (Array.isArray(origin)) {
		appendVary();
		if (requestOrigin && origin.includes(requestOrigin)) {
			headers.set("Access-Control-Allow-Origin", requestOrigin);
		}
		return;
	}

	if (origin !== "*") {
		appendVary();
	}
	headers.set("Access-Control-Allow-Origin", origin);
}

provideMiddleware({ name: "cors", priority: 200, factory: () => cors() });
