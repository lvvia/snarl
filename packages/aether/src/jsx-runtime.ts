/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import * as snarl from "@july/snarl/jsx-runtime";
import { jsx as snarl$jsx } from "@july/snarl/jsx-runtime";

import { island } from "./server/island.ts";
import { getIslandMeta } from "./server/registry.ts";
import { isReactive } from "@404/aether/reactivity";

//deno-lint-ignore ban-types
const wrappers = new WeakMap<Function, ReturnType<typeof island>>();

function maybeRenderIsland(tag: unknown, props: any): any {
	if (typeof tag !== "function") return null;

	const meta = getIslandMeta(tag);
	if (!meta) return null;

	const wrapper = wrappers.getOrInsertComputed(tag, () => island(meta));
	return wrapper(props ?? {});
}

function unwrapReactive(value: unknown): unknown {
	if (isReactive(value)) return (value as () => unknown)();
	if (Array.isArray(value)) return value.map(unwrapReactive);
	return value;
}

function jsx(tag: any, props: any): any {
	const island = maybeRenderIsland(tag, props);
	if (island) return island;

	if (props != null) {
		const unwrapped: Record<string, unknown> = {};
		for (const key of Object.keys(props)) {
			unwrapped[key] = unwrapReactive(props[key]);
		}
		return snarl$jsx(tag, unwrapped);
	}
	return snarl$jsx(tag, props);
}

export const Fragment = snarl.Fragment;
export const voidTags = snarl.voidTags;
export const isJsxElement = snarl.isJsxElement;
export const jsxEscape = snarl.jsxEscape;
export const jsxAttr = snarl.jsxAttr;
export const jsxTemplate = snarl.jsxTemplate;
export const renderToString = snarl.renderToString;

export type { JSX } from "@july/snarl/jsx-runtime";

export { jsx, jsx as jsxDEV, jsx as jsxs };
