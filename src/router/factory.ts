/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Handler, Middleware } from "../context/middleware.ts";
import {
	httpMethods,
	type Method,
	type ParametersOf,
	type PreciseURLPattern,
	url,
} from "../types.ts";
import { createDispatcher, createEmptyExactTable, createEmptyRouteTable } from "./dispatch.ts";
import { createNode, insertRoute, type RadixNode, type TreeOptions } from "./tree.ts";
import { extractPattern, type Route, type RouteMetadata, type RoutePayload } from "./route.ts";
import { createPrefixedRouter } from "./group.ts";
import { resolveRouterConfig, type RouterConfig } from "./config.ts";

type Params<P> = P extends PreciseURLPattern<any> ? ParametersOf<P["raw"]>
	: P extends string ? ParametersOf<P>
	: P extends URLPattern ? Record<string, string>
	: never;

interface Router {
	routes: Record<Method, Route<any>[]>;
	middlewares: Middleware[];
	config: RouterConfig;

	use(...middlewares: (Middleware | Middleware[])[]): this;

	on<P extends string | PreciseURLPattern<any> | URLPattern>(
		method: Method,
		path: P,
		handler: Handler<Params<P>>,
		metadata?: RouteMetadata,
	): void;

	group(prefix: string, configure: (router: HttpRouter) => void): this;

	fetch(request: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response>;

	allRoutes(): Array<{ method: Method; pattern: Route<any>["pattern"]; metadata?: RouteMetadata }>;

	serve(options?: Deno.ServeTcpOptions): ReturnType<typeof Deno.serve>;
}

type HttpRouter =
	& Router
	& {
		[M in Method as Lowercase<M>]: <P extends string | PreciseURLPattern<any> | URLPattern>(
			path: P,
			handler: Handler<Params<P>>,
			metadata?: RouteMetadata,
		) => Router;
	}
	& {
		all<P extends string | PreciseURLPattern<any> | URLPattern>(
			path: P,
			handler: Handler<Params<P>>,
			metadata?: RouteMetadata,
		): Router;
	};

/**
 * creates a new `HttpRouter`
 *
 * @param baseConfig optional configuration. see {@link RouterConfig} for
 * case-sensitivity, trailing-slash handling, and error/not-found overrides
 */
export function createRouter(baseConfig: Partial<RouterConfig> = {}): HttpRouter {
	const config = resolveRouterConfig(baseConfig);
	const treeOptions: TreeOptions = {
		caseSensitive: config.caseSensitive,
		trailingSlashSensitive: config.trailingSlash === "strict",
	};

	const routes = createEmptyRouteTable();
	const exactRoutes = createEmptyExactTable();
	const trees: Record<Method, RadixNode<RoutePayload>> = Object.fromEntries(
		httpMethods.map((m) => [m, createNode("")]),
	) as Record<Method, RadixNode<RoutePayload>>;

	const middlewares: Middleware[] = [];

	const r: Partial<HttpRouter> = {
		routes,
		middlewares,
		config,

		use(...mw: (Middleware | Middleware[])[]) {
			middlewares.push(...mw.flat());
			return r as HttpRouter;
		},

		on<P extends string | PreciseURLPattern<any> | URLPattern>(
			method: Method,
			path: P,
			handler: Handler<Params<P>>,
			metadata?: RouteMetadata,
		) {
			const base = extractPattern(path);
			const pathname = encodeURI(config.prefix + "/" + base).replace(/\/+/g, "/");

			const pattern = url({ pathname });
			const route: Route<any> = { method, pattern, handler: handler as any, metadata };

			routes[method].push(route);
			const payload: RoutePayload = { handler: route.handler, route };
			insertRoute(trees[method], pathname, payload, treeOptions);

			if (!base.includes(":") && !base.includes("*") && !base.includes("?")) {
				exactRoutes[method][pathname] = route;
			}
			return r;
		},

		all<P extends string | PreciseURLPattern<any> | URLPattern>(
			path: P,
			handler: Handler<Params<P>>,
			metadata?: RouteMetadata,
		) {
			for (const method of httpMethods) r.on!(method, path, handler, metadata);
			return r as HttpRouter;
		},

		group(prefix, configure) {
			const prefixed = createPrefixedRouter(r as HttpRouter, prefix);
			configure(prefixed);
			return prefixed;
		},

		allRoutes() {
			return httpMethods.flatMap((method) =>
				routes[method].map((route) => ({
					method,
					pattern: route.pattern,
					metadata: route.metadata,
				}))
			);
		},

		serve(opts) {
			opts ??= {} as unknown as typeof opts;
			opts!.onListen ??= config.onListen;
			return Deno.serve(opts!, r.fetch!);
		},
	};

	const dispatcher = createDispatcher({ trees, exactRoutes, middlewares, config });
	r.fetch = dispatcher.fetch;

	httpMethods.forEach((method) => {
		const lower = method.toLowerCase() as Lowercase<Method>;
		(r as any)[lower] = <P extends string>(
			path: P,
			handler: Handler<Params<P>>,
			metadata?: RouteMetadata,
		) => r.on!(method as Method, path, handler, metadata);
	});

	return r as HttpRouter;
}

export type { HttpRouter as Router };
