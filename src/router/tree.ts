/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

export interface RadixNode<T> {
	segment: string;
	optional: boolean;
	children: Map<string, RadixNode<T>>;
	paramChild: RadixNode<T> | null;
	wildcardChild: RadixNode<T> | null;
	payload: T | null;
}

export function createNode<T>(segment: string, optional = false): RadixNode<T> {
	return {
		segment,
		optional,
		children: new Map(),
		paramChild: null,
		wildcardChild: null,
		payload: null,
	};
}

export interface TreeOptions {
	caseSensitive?: boolean;
	trailingSlashSensitive?: boolean;
}

function normaliseSegment(seg: string, caseSensitive: boolean): string {
	return caseSensitive ? seg : seg.toLowerCase();
}

export function canPossiblyMatch<T>(
	root: RadixNode<T>,
	firstSegment: string,
	caseSensitive: boolean,
): boolean {
	if (root.paramChild || root.wildcardChild) return true;
	return root.children.has(normaliseSegment(firstSegment, caseSensitive));
}

export function getSegments(pattern: string, trailingSlashSensitive: boolean): string[] {
	const segments: string[] = [];
	let start = 0;

	while (true) {
		const idx = pattern.indexOf("/", start);

		if (idx === -1) {
			if (start < pattern.length) {
				segments.push(pattern.slice(start));
			} else if (
				trailingSlashSensitive &&
				pattern.length > 1 &&
				pattern.charCodeAt(start - 1) === /* '/' */ 47
			) {
				segments.push("");
			}
			break;
		}

		if (idx > start) {
			segments.push(pattern.slice(start, idx));
		}
		start = idx + 1;
	}

	return segments;
}

export function insertRoute<T>(
	root: RadixNode<T>,
	pattern: string,
	payload: T,
	options: TreeOptions = {},
): void {
	const caseSensitive = options.caseSensitive ?? true;
	const segments = getSegments(pattern, options.trailingSlashSensitive ?? false);

	let node = root;

	for (const rawSeg of segments) {
		let child: RadixNode<T> | null = null;

		if (rawSeg.startsWith("*")) {
			if (!node.wildcardChild) {
				const name = rawSeg.length > 1 ? rawSeg.slice(1) : "*";
				node.wildcardChild = createNode(name);
			}
			child = node.wildcardChild;
		} else if (rawSeg.startsWith(":")) {
			const optional = rawSeg.endsWith("?");
			const paramName = optional ? rawSeg.slice(1, -1) : rawSeg.slice(1);
			if (!node.paramChild) {
				node.paramChild = createNode(paramName, optional);
			}
			child = node.paramChild;
		} else {
			const seg = normaliseSegment(rawSeg, caseSensitive);
			child = node.children.get(seg) ?? null;
			if (!child) {
				child = createNode(seg);
				node.children.set(seg, child);
			}
		}

		if (!child) break;
		node = child;
	}

	node.payload = payload;
}

export interface MatchResult<T> {
	payload: T;
	params?: Record<string, string>;
}

export function matchRoute<T>(
	node: RadixNode<T>,
	segments: string[],
	idx: number,
	params: Record<string, string>,
	options: TreeOptions = {},
): MatchResult<T> | null {
	if (idx >= segments.length) {
		if (node.payload !== null) return { payload: node.payload };

		if (node.wildcardChild) {
			const wc = node.wildcardChild;
			params[wc.segment] = "";
			if (wc.payload !== null) return { payload: wc.payload };
		}

		let pc = node.paramChild;
		while (pc && pc.optional) {
			if (pc.payload !== null) return { payload: pc.payload };
			pc = pc.paramChild;
		}
		return null;
	}

	const caseSensitive = options.caseSensitive ?? true;
	const seg = normaliseSegment(segments[idx], caseSensitive);

	const staticChild = node.children.get(seg);
	if (staticChild) {
		const result = matchRoute(staticChild, segments, idx + 1, params, options);
		if (result) return result;
	}

	if (node.paramChild) {
		const pc = node.paramChild;
		let decoded = segments[idx];
		if (decoded.indexOf("%") !== -1) {
			try {
				decoded = decodeURIComponent(decoded);
			} catch { /* no-op */ }
		}

		params[pc.segment] = decoded;
		const result = matchRoute(pc, segments, idx + 1, params, options);
		if (result) return result;
		delete params[pc.segment];

		if (pc.optional) {
			const skipResult = matchRoute(pc, segments, idx, params, options);
			if (skipResult) return skipResult;
		}
	}

	if (node.wildcardChild) {
		const wc = node.wildcardChild;
		const remaining = idx < segments.length ? segments.slice(idx).join("/") : "";
		params[wc.segment] = remaining;
		if (wc.payload !== null) return { payload: wc.payload };
	}

	return null;
}
