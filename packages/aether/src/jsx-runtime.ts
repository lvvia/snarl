/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import * as snarl from "@july/snarl/jsx-runtime";

import { island } from "./server/island.ts";
import { getIslandMeta } from "./server/registry.ts";
import { isReactive } from "./reactivity/mod.ts";
import { For, Show } from "./control-flow.ts";

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
	if (isReactive(value)) return unwrapReactive((value as () => unknown)());

	if (Array.isArray(value)) return value.map(unwrapReactive);
	if (
		value != null && typeof value === "object" &&
		!snarl.isJsxElement(value) && (value as object).constructor === Object
	) {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value as Record<string, unknown>)) {
			out[k] = unwrapReactive((value as Record<string, unknown>)[k]);
		}
		return out;
	}
	return value;
}

function handleBinding(
	target: string,
	value: unknown,
	out: Record<string, unknown>,
	groupState: { value: unknown; hasBind: boolean },
) {
	if (target === "group") {
		groupState.value = value;
		groupState.hasBind = true;
	} else if (target === "checked") {
		out.checked = Boolean(value);
	} else {
		out.value = value ?? "";
	}
}

function finaliseGroupBinding(
	groupState: { value: unknown; hasBind: boolean },
	out: Record<string, unknown>,
) {
	if (groupState.hasBind) {
		out.checked = String(groupState.value) === String(out.value ?? "");
	}
}

function finaliseClasses(classToggles: string[], out: Record<string, unknown>) {
	if (classToggles.length) {
		out.class = [out.class, ...classToggles].filter(Boolean).join(" ");
	}
}

function jsx<P extends JSX.Props = JSX.Props>(
	tag: JSX.Element["tag"],
	props: P | null = {} as P,
): JSX.Element {
	if (tag === "for") return For(props as any);
	if (tag === "show") return Show(props as any);

	const rendered = maybeRenderIsland(tag, props);
	if (rendered) return rendered;
	if (props == null) return snarl.jsx(tag, props);

	const out: Record<string, unknown> = {};
	const classToggles: string[] = [];
	const groupState = { value: undefined as unknown, hasBind: false };

	for (const key of Object.keys(props)) {
		const value = unwrapReactive(props[key]);

		if (key.startsWith("bind:")) {
			handleBinding(key.slice(5), value, out, groupState);
		} else if (key.startsWith("class:")) {
			if (value) classToggles.push(key.slice(6));
		} else {
			out[key] = value;
		}
	}

	finaliseGroupBinding(groupState, out);
	finaliseClasses(classToggles, out);

	return snarl.jsx(tag, out);
}

export const Fragment = snarl.Fragment;
export const voidTags = snarl.voidTags;
export const isJsxElement = snarl.isJsxElement;
export const jsxEscape = snarl.jsxEscape;
export const jsxAttr = snarl.jsxAttr;
export const jsxTemplate = snarl.jsxTemplate;
export const renderToString = snarl.renderToString;

export declare namespace JSX {
	export type Element = snarl.JSX.Element;
	export type Node = snarl.JSX.Node;
	export type Props = snarl.JSX.Props;
	export type Fragment = typeof Fragment;

	export type FC<P extends Props = Props> = snarl.JSX.FC<P>;

	/** defines valid JSX elements */
	export type ElementType = snarl.JSX.ElementType;

	export interface ElementChildrenAttribute {
		// deno-lint-ignore ban-types
		children: {};
	}

	export type IntrinsicAttributes = snarl.JSX.IntrinsicAttributes;

	/** type definitions for intrinsic HTML and SVG elements */
	export type IntrinsicElements =
		& snarl.JSX.IntrinsicElements
		& {
			for: Parameters<typeof For<any>>[0];
			show: Parameters<typeof Show<any>>[0];
		};
}

export { jsx, jsx as jsxDEV, jsx as jsxs };
