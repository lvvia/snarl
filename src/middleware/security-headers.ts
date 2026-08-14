/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Middleware } from "../context/middleware.ts";

export type CspDirective =
	| "default-src"
	| "base-uri"
	| "object-src"
	| "frame-ancestors"
	| "form-action"
	| "script-src"
	| "style-src"
	| "img-src"
	| "connect-src"
	| "font-src"
	| "media-src"
	| "worker-src"
	| "manifest-src"
	| "prefetch-src"
	| "child-src"
	| "frame-src"
	| "report-uri"
	| "report-to";

export interface SecurityHeadersOptions {
	contentSecurityPolicy?: Partial<Record<CspDirective, string>> | string;
	strictTransportSecurity?: string;
	xContentTypeOptions?: "nosniff";
	referrerPolicy?: string;
	permissionsPolicy?: string;
	crossOriginOpenerPolicy?: string;
	crossOriginEmbedderPolicy?: string;
	crossOriginResourcePolicy?: string;
	cacheControl?: string;
}

const DEFAULT_DIRECTIVES: Partial<Record<CspDirective, string>> = {
	"default-src": "'self'",
	"base-uri": "'self'",
	"object-src": "'none'",
	"frame-ancestors": "'self'",
	"form-action": "'self'",
};

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
		contentSecurityPolicy = DEFAULT_DIRECTIVES,
		strictTransportSecurity = "max-age=31536000; includeSubDomains",
		xContentTypeOptions = "nosniff",
		referrerPolicy = "strict-origin-when-cross-origin",
		permissionsPolicy = "camera=(), microphone=(), geolocation=()",
		crossOriginOpenerPolicy = "same-origin",
		crossOriginEmbedderPolicy = "require-corp",
		crossOriginResourcePolicy = "same-origin",
		cacheControl,
	} = options;

	let csp: string;
	if (typeof contentSecurityPolicy === "string") {
		csp = contentSecurityPolicy;
	} else {
		const merged = { ...DEFAULT_DIRECTIVES, ...contentSecurityPolicy };
		const parts: string[] = [];
		for (const [key, value] of Object.entries(merged)) {
			if (value != null && value !== "") {
				parts.push(`${key} ${value}`);
			}
		}
		csp = parts.length ? `${parts.join("; ")};` : "";
	}

	const headers = new Headers();
	if (csp) headers.set("Content-Security-Policy", csp);
	if (strictTransportSecurity) headers.set("Strict-Transport-Security", strictTransportSecurity);
	if (xContentTypeOptions) headers.set("X-Content-Type-Options", xContentTypeOptions);
	if (referrerPolicy) headers.set("Referrer-Policy", referrerPolicy);
	if (permissionsPolicy) headers.set("Permissions-Policy", permissionsPolicy);
	if (crossOriginOpenerPolicy) headers.set("Cross-Origin-Opener-Policy", crossOriginOpenerPolicy);
	if (crossOriginEmbedderPolicy) {
		headers.set("Cross-Origin-Embedder-Policy", crossOriginEmbedderPolicy);
	}
	if (crossOriginResourcePolicy) {
		headers.set("Cross-Origin-Resource-Policy", crossOriginResourcePolicy);
	}
	if (cacheControl) headers.set("Cache-Control", cacheControl);

	return async (_ctx, next) => {
		const state = await next();

		for (const [key, value] of headers.entries()) {
			state.headers.set(key, value);
		}

		return state;
	};
}
