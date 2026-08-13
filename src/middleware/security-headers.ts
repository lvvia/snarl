/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Middleware } from "../context/middleware.ts";

export interface SecurityHeadersOptions {
	contentSecurityPolicy?: string;
	strictTransportSecurity?: string;
	xContentTypeOptions?: "nosniff";
	referrerPolicy?: string;
	permissionsPolicy?: string;
	crossOriginOpenerPolicy?: string;
	crossOriginEmbedderPolicy?: string;
	crossOriginResourcePolicy?: string;
	cacheControl?: string;
}

/**
 * middleware that adds security headers to the response
 *
 * @example
 * ```ts
 * app.use(securityHeaders({ contentSecurityPolicy: "default-src 'self' 'unsafe-inline'" }));
 * ```
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): Middleware {
	const {
		contentSecurityPolicy = [
			"default-src 'self'",
			"base-uri 'self'",
			"object-src 'none'",
			"frame-ancestors 'self'",
			"form-action 'self'",
		].join("; "),
		strictTransportSecurity = "max-age=31536000; includeSubDomains",
		xContentTypeOptions = "nosniff",
		referrerPolicy = "strict-origin-when-cross-origin",
		permissionsPolicy = "camera=(), microphone=(), geolocation=()",
		crossOriginOpenerPolicy = "same-origin",
		crossOriginEmbedderPolicy = "require-corp",
		crossOriginResourcePolicy = "same-origin",
		cacheControl,
	} = options;

	return async (_ctx, next) => {
		const state = await next();
		const headers = state.headers;

		if (contentSecurityPolicy) headers.set("Content-Security-Policy", contentSecurityPolicy);
		if (strictTransportSecurity) headers.set("Strict-Transport-Security", strictTransportSecurity);
		if (xContentTypeOptions) headers.set("X-Content-Type-Options", xContentTypeOptions);
		if (referrerPolicy) headers.set("Referrer-Policy", referrerPolicy);
		if (permissionsPolicy) headers.set("Permissions-Policy", permissionsPolicy);
		if (crossOriginOpenerPolicy) headers.set("Cross-Origin-Opener-Policy", crossOriginOpenerPolicy);
		if (crossOriginEmbedderPolicy) headers.set("Cross-Origin-Embedder-Policy", crossOriginEmbedderPolicy);
		if (crossOriginResourcePolicy) headers.set("Cross-Origin-Resource-Policy", crossOriginResourcePolicy);
		if (cacheControl) headers.set("Cache-Control", cacheControl);

		return state;
	};
}
