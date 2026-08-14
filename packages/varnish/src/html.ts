/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

const DOCTYPE_RE = /^\s*<!doctype\b[^>]*>\s*/i;

export function splitDoctype(input: string): { doctype: string; rest: string } {
	const match = input.match(DOCTYPE_RE);
	return match ? { doctype: match[0], rest: input.slice(match[0].length) } : { doctype: "", rest: input };
}
