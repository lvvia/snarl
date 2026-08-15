/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Middleware } from "../context/mod.ts";
import { HttpError } from "../errors.ts";

export interface CsrfOptions {
	cookieName?: string;
	headerName?: string;
	formFieldName?: string;
}

export function csrf(options: CsrfOptions = {}): Middleware {
	const {
		cookieName = "csrf-token",
		headerName = "x-csrf-token",
		formFieldName = "_csrf",
	} = options;

	return (ctx, next) => {
		let token = ctx.cookies.get(cookieName);
		if (!token) {
			token = crypto.randomUUID();
			ctx.cookies.set(cookieName, token, { httpOnly: false, sameSite: "Strict", path: "/" });
		}

		if (["POST", "PUT", "PATCH", "DELETE"].includes(ctx.request.method)) {
			const headerToken = ctx.request.headers.get(headerName);
			let formToken = null;

			if (
				ctx.bodyCache && typeof ctx.bodyCache === "object" &&
				formFieldName in (ctx.bodyCache as any)
			) {
				formToken = (ctx.bodyCache as any)[formFieldName];
			}

			const provided = headerToken || formToken;
			if (!provided || provided !== token) {
				throw new HttpError(403, "Invalid CSRF token");
			}
		}

		ctx.state.set("csrfToken", token);
		return next();
	};
}
