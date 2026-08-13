/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { compose, Context, type Handler, type Middleware } from "../context/mod.ts";
import { httpMethods, type Method } from "../types.ts";
import { HttpError } from "../errors.ts";
import { canPossiblyMatch, getSegments, matchRoute, type RadixNode, type TreeOptions } from "./tree.ts";
import type { Route, RoutePayload } from "./route.ts";
import type { RouterConfig } from "./config.ts";

const EMPTY_200 = new Response(null, { status: 200 });
const EMPTY_PARAMS: Readonly<Record<string, string>> = Object.freeze(Object.create(null));

export interface DispatchState {
	readonly trees: Record<Method, RadixNode<RoutePayload>>;
	readonly exactRoutes: Record<Method, Record<string, Route<any>>>;
	readonly middlewares: Middleware[];
	readonly config: RouterConfig;
}

export function createRequestIdGenerator(): () => string {
	let state = crypto.getRandomValues(new Uint32Array(1))[0];
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0).toString(36).padStart(6, "0");
	};
}

function hasTrailingSlash(pathname: string): boolean {
	return pathname.length > 1 && pathname.charCodeAt(pathname.length - 1) === /* "/" */ 47;
}

interface PathParts {
	pathname: string;
	search: string;
}

function extractPathParts(rawUrl: string): PathParts {
	const schemeEnd = rawUrl.indexOf("://");
	if (schemeEnd === -1) return fallbackPathParts(rawUrl);

	const pathStart = rawUrl.indexOf("/", schemeEnd + 3);
	if (pathStart === -1) return { pathname: "/", search: "" };

	const hashIdx = rawUrl.indexOf("#", pathStart);
	const end = hashIdx === -1 ? rawUrl.length : hashIdx;

	const queryIdx = rawUrl.indexOf("?", pathStart);
	if (queryIdx === -1 || queryIdx > end) {
		return { pathname: rawUrl.slice(pathStart, end), search: "" };
	}
	return {
		pathname: rawUrl.slice(pathStart, queryIdx),
		search: rawUrl.slice(queryIdx, end),
	};
}

function fallbackPathParts(rawUrl: string): PathParts {
	const url = new URL(rawUrl);
	return { pathname: url.pathname, search: url.search };
}

type Resolved = { handler: Handler<any>; route: Route<any>; params: Record<string, string> };

function lookupMethod(
	trees: Record<Method, RadixNode<RoutePayload>>,
	exactRoutes: Record<Method, Record<string, Route<any>>>,
	method: Method,
	pathname: string,
	treeOptions: TreeOptions,
): Resolved | null {
	const exact = exactRoutes[method]?.[pathname];
	if (exact) return { handler: exact.handler, route: exact, params: EMPTY_PARAMS };

	if (pathname !== "/") {
		const caseSensitive = treeOptions.caseSensitive ?? true;
		const firstSlash = pathname.indexOf("/", 1);
		const firstSegment = firstSlash === -1 ? pathname.slice(1) : pathname.slice(1, firstSlash);

		if (!canPossiblyMatch(trees[method], firstSegment, caseSensitive)) return null;
	}

	const segments = pathname === "/" ? [] : getSegments(pathname, treeOptions.trailingSlashSensitive ?? false);
	const params: Record<string, string> = Object.create(null);
	const result = matchRoute(trees[method], segments, 0, params, treeOptions);

	return result ? { handler: result.payload.handler, route: result.payload.route, params } : null;
}

function resolve(
	state: DispatchState,
	treeOptions: TreeOptions,
	method: Method,
	pathname: string,
): Resolved | null {
	const primary = lookupMethod(state.trees, state.exactRoutes, method, pathname, treeOptions);
	if (primary || method !== "HEAD") return primary;

	return lookupMethod(state.trees, state.exactRoutes, "GET", pathname, treeOptions);
}

export function createDispatcher(state: DispatchState): {
	fetch: (request: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>) => Promise<Response>;
} {
	const nextRequestId = createRequestIdGenerator();

	const trailingSlashMode = state.config.trailingSlash;
	const treeOptions: TreeOptions = {
		caseSensitive: state.config.caseSensitive,
		trailingSlashSensitive: trailingSlashMode === "strict",
	};

	const composedCache = new WeakMap<Handler<any>, Handler<any>>();
	let composedNotFound: Handler<any> | null = null;

	async function fetch(request: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response> {
		composedNotFound ??= state.middlewares.length
			? compose(state.middlewares, state.config.onNotFound)
			: state.config.onNotFound;

		const method = request.method.toUpperCase() as Method;
		const { pathname, search } = extractPathParts(request.url);

		const trailing = hasTrailingSlash(pathname);
		const lookupPathname = trailing && trailingSlashMode !== "strict" ? pathname.slice(0, -1) : pathname;

		const match = resolve(state, treeOptions, method, lookupPathname);

		if (trailing && trailingSlashMode === "redirect" && match) {
			return new Response(null, {
				status: 308,
				headers: { Location: lookupPathname + search },
			});
		}

		let ctx: Context<any> | null = null;
		try {
			ctx = new Context(request, pathname, search, info, match?.params ?? EMPTY_PARAMS, nextRequestId);

			let handler: Handler<any>;
			if (!state.middlewares.length) {
				handler = match ? match.route.handler : state.config.onNotFound;
			} else if (!match) {
				handler = composedNotFound;
			} else {
				let cached = composedCache.get(match.route.handler);
				if (!cached) {
					composedCache.set(match.route.handler, cached = compose(state.middlewares, match.route.handler));
				}
				handler = cached;
			}

			const response = await handler(ctx);

			if (method === "HEAD" && response?.body) {
				return new Response(null, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
				});
			}
			return response ?? EMPTY_200;
		} catch (err) {
			ctx ??= new Context(request, pathname, search, info, EMPTY_PARAMS, nextRequestId);
			if (err instanceof HttpError) {
				return ctx.json({ error: err.message }, { status: err.status, headers: err.headers });
			}
			return await state.config.onError(err as Error, ctx);
		}
	}

	return { fetch };
}

export function createEmptyRouteTable(): Record<Method, Route<any>[]> {
	return Object.fromEntries(httpMethods.map((m) => [m, []])) as Record<string, Route<any>[]>;
}

export function createEmptyExactTable(): Record<Method, Record<string, Route<any>>> {
	return Object.fromEntries(httpMethods.map((m) => [m, {}])) as Record<Method, Record<string, Route<any>>>;
}
