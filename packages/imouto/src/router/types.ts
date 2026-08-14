/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Context, Method, Middleware } from "@july/snarl";

export type RouteHandler = (ctx: Context) => Response | Promise<Response> | unknown;
export type RouteModule = { default?: RouteHandler } & { [K in Method]?: RouteHandler };
export type LayoutModule = { default: (props: { children: unknown; ctx: Context }) => unknown };
export type MiddlewareModule = { default: Middleware | Middleware[] };
export type ErrorModule = { default: (props: { error: Error; ctx: Context }) => unknown };
export type NotFoundModule = { default: (props: { ctx: Context }) => unknown };

export interface ScanEntry {
	path: string;
	fsPath: string;
	module: RouteModule;
	depth: number;
}

export interface RootRouteMetadata {
	layout?: LayoutModule;
	middlewares: Middleware[];
	errorBoundary?: ErrorModule;
	notFound?: NotFoundModule;
}

export interface ScanOptions {
	/** directory to scan for route files */
	dir: string;
	/** path resolution module url specification */
	from?: string;
	/** whether to log registered routes */
	verbose?: boolean;
}
