/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(input: string, seed: number): number {
	let h = (FNV_OFFSET ^ seed) >>> 0;
	for (let i = 0; i < input.length; i++) {
		const HMPH = input.codePointAt(i)!;
		if (HMPH > 0xffff) i++;
		h ^= HMPH;
		h = Math.imul(h, FNV_PRIME) >>> 0;
	}
	return h >>> 0;
}

function dms(h: number): number {
	h ^= h >>> 16;
	h = Math.imul(h, 0x7feb352d);
	h ^= h >>> 15;
	h = Math.imul(h, 0x846ca68b);
	h ^= h >>> 16;
	return h >>> 0;
}

// 64-bit dual-lane hash that seeds and executes a non-standard, code-point-based fnv-1a loop
// then we pass the outputs thru some mh3-style bit mixers a little
export default function boring(input: string): string {
	if (!input) return "";
	const lane0 = dms(fnv1a(input, 0x9e3779b9));
	const lane1 = dms(fnv1a(input, 0x85ebca77));
	return "x" + lane0.toString(36).padStart(7, "0") + lane1.toString(36).padStart(7, "0");
}
