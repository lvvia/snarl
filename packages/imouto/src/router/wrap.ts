/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Context, JSX } from "@july/snarl";
import type { ErrorModule, LayoutModule, RouteHandler } from "./types.ts";

export function wrapHandler(
	handler: RouteHandler,
	layouts: LayoutModule[],
	errorBoundary: ErrorModule | undefined,
) {
	return async (ctx: Context): Promise<Response> => {
		try {
			return await render(ctx, handler, layouts);
		} catch (err) {
			return await renderErrorBoundary(ctx, errorBoundary, err as Error);
		}
	};
}

async function render(ctx: Context, handler: RouteHandler, layouts: LayoutModule[]): Promise<Response> {
	let result = await handler(ctx);
	if (result instanceof Response) return result;

	// outermost layout applies last, so walk leaf -> root
	for (const layout of layouts.toReversed()) {
		result = await layout.default({ children: result, ctx });
		if (result instanceof Response) return result;
	}

	return await ctx.html(result as JSX.Node);
}

async function renderErrorBoundary(
	ctx: Context,
	errorBoundary: ErrorModule | undefined,
	error: Error,
): Promise<Response> {
	const result = await errorBoundary?.default({ error, ctx });
	if (result === undefined) throw error;
	if (result instanceof Response) return result;
	return await ctx.html(result as JSX.Node, { status: 500 });
}
