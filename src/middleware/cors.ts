/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { type Middleware, MutableResponse } from "../context/middleware.ts";
import { httpMethods } from "../types.ts";

export interface CorsOptions {
	origin?: string | string[];
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
	const isOriginList = Array.isArray(origin);

	return async (ctx, next) => {
		const preflight = ctx.request.method === "OPTIONS";
		const requestOrigin = ctx.request.headers.get("Origin");

		if (preflight) {
			const headers = new Headers();
			applyOrigin(headers, requestOrigin, origin, isOriginList);

			headers.set("Access-Control-Allow-Methods", methodsHeader);
			headers.set("Access-Control-Allow-Headers", headersHeader);

			if (credentials) headers.set("Access-Control-Allow-Credentials", "true");
			if (maxAge) headers.set("Access-Control-Max-Age", maxAge.toString());

			return new MutableResponse(null, { status: 204, headers });
		}

		const state = await next();
		applyOrigin(state.headers, requestOrigin, origin, isOriginList);
		state.headers.set("Access-Control-Allow-Methods", methodsHeader);
		state.headers.set("Access-Control-Allow-Headers", headersHeader);
		if (credentials) state.headers.set("Access-Control-Allow-Credentials", "true");

		return state;
	};
}

function applyOrigin(
	headers: Headers,
	requestOrigin: string | null,
	origin: string | string[],
	isList: boolean,
): void {
	if (isList) {
		if (requestOrigin && (origin as string[]).includes(requestOrigin)) {
			headers.set("Access-Control-Allow-Origin", requestOrigin);
		}
	} else {
		headers.set("Access-Control-Allow-Origin", origin as string);
	}
}
