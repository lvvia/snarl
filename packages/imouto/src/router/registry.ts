/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Handler, Method, Middleware, Router } from "@july/snarl";
import { compose } from "@july/snarl";
import { formatRoute, formatRouteFile } from "./format.ts";
import { dim } from "@std/fmt/colors";
import type { ErrorModule, LayoutModule } from "./types.ts";
import { wrapHandler } from "./wrap.ts";

export function registerRoute(
	router: Router,
	method: Method,
	path: string,
	handler: (ctx: any) => unknown,
	layouts: LayoutModule[],
	middlewares: Middleware[],
	errorBoundary: ErrorModule | undefined,
	fsPath: string,
	base: string,
	registered: Set<string>,
	verbose: boolean,
): void {
	const key = `${method}:${path}`;
	const start = performance.now();

	const wrapped = wrapHandler(handler as any, layouts, errorBoundary);
	const final: Handler<any> = middlewares.length ? compose(middlewares, wrapped) : wrapped;
	(router as any)[method.toLowerCase()](path, final);

	if (!verbose || registered.has(key)) return;
	registered.add(key);
	console.log(
		`    ${formatRoute(method, path)} ${formatRouteFile(fsPath.slice(base.length + 1))} ${
			dim(`${(performance.now() - start).toFixed(2)}ms`)
		}`,
	);
}
