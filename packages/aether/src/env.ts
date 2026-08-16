/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

export const isBrowser: boolean = typeof document !== "undefined" &&
	typeof document.createElement === "function";

export const isServer: boolean = !isBrowser;

/** runs `fn` only in the browser */
export function browser<T>(fn: () => T): T | undefined {
	return isBrowser ? fn() : undefined;
}
