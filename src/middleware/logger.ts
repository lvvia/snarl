/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Context, Middleware } from "../context/mod.ts";
import { blue, dim, green, red, reset, yellow } from "@std/fmt/colors";
import { MiddlewarePriority, provideMiddleware } from "./manager.ts";

function statusColour(status: number): typeof reset {
	if (status >= 200 && status < 300) return green;
	if (status >= 300 && status < 400) return blue;
	if (status >= 400 && status < 500) return yellow;
	if (status >= 500) return red;
	return reset;
}

export interface LoggerOptions {
	/** custom formatter for the log line */
	format?: (ctx: Context, ms: number, status: number) => string;
	/** custom log function. defaults to `console.log` */
	log?: (...args: any[]) => void;
	/** whether to enable logging. defaults to `true` */
	enabled?: boolean;
}

/** middleware that logs HTTP request details */
export function logger(options: LoggerOptions = {}): Middleware {
	const { format, log = console.log, enabled = true } = options;
	return async (ctx, next) => {
		if (!enabled) return next();

		const start = performance.now();
		const response = await next();
		const elapsed = performance.now() - start;

		if (format) {
			log(format(ctx, elapsed, response.status));
		} else {
			const method = ctx.request.method;
			const path = ctx.url.pathname;
			const status = response.status;
			const color = statusColour(status);
			log(
				dim(`[${ctx.requestId}]`),
				color(`${method} ${path}`),
				`${status} ${elapsed.toFixed(2)}ms`,
			);
		}
		return response;
	};
}

provideMiddleware({
	name: "logger",
	priority: MiddlewarePriority.late,
	factory: () => logger(),
});
