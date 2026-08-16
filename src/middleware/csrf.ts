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

async function eq(a: string, b: string): Promise<boolean> {
	const enc = new TextEncoder();
	const [da, db] = await Promise.all([
		crypto.subtle.digest("SHA-256", enc.encode(a)),
		crypto.subtle.digest("SHA-256", enc.encode(b)),
	]);
	const ba = new Uint8Array(da);
	const bb = new Uint8Array(db);

	let diff = 0;
	for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
	return diff === 0;
}

export function csrf(options: CsrfOptions = {}): Middleware {
	const {
		cookieName = "csrf-token",
		headerName = "x-csrf-token",
		formFieldName = "_csrf",
	} = options;

	return async (ctx, next) => {
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

			if (!provided || !(await eq(provided, token))) {
				throw new HttpError(403, "Invalid CSRF token");
			}
		}

		ctx.state.set("csrfToken", token);
		return next();
	};
}
