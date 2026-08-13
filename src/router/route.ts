/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { Handler } from "../context/middleware.ts";
import type { Method, ParametersOf, PreciseURLPattern } from "../types.ts";

export interface Route<P extends string> {
	readonly pattern: PreciseURLPattern<P>;
	handler: Handler<ParametersOf<P>>;
	method: Method;
	metadata?: RouteMetadata;
}

export interface RouteMetadata {
	description?: string;
	tags?: string[];
	deprecated?: boolean;
	params?: Record<string, { type: string; description?: string }>;
	responses?: Record<number, { description: string }>;
}

export interface RoutePayload {
	handler: Handler<any>;
	route: Route<any>;
}

export function extractPattern(
	pattern: string | PreciseURLPattern<any> | URLPattern,
): string {
	if (typeof pattern === "string") return pattern;
	return (pattern as PreciseURLPattern<any>).raw ?? pattern.pathname;
}
