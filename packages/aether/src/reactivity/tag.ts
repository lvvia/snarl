/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { NodeKind } from "./types.ts";

export function tag<F extends (...args: never[]) => unknown>(fn: F, kind: NodeKind): F {
	return Object.assign(fn, { kind });
}

export function kindOf(value: unknown): NodeKind | undefined {
	return typeof value === "function" ? (value as { kind?: NodeKind }).kind : undefined;
}
