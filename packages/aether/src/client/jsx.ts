/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { type Computed, effect, isReactive, type Signal } from "@404/aether/reactivity";

export const voidTags: ReadonlySet<string> = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

export const Fragment = Symbol.for("jsx.fragment");

const ESC_RE = /[&<>"']/;
const SAFE_ATTR_RE = /^[a-zA-Z_:][-\w:.]*$/;

function encode(str: string): string {
	if (!str || !ESC_RE.test(str)) return str;
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function jsxEscape(value: unknown): string {
	if (value == null || value === false) return "";
	if (typeof value === "string") return encode(value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map(jsxEscape).join("");
	if (typeof value === "object" && value !== null) {
		if ("__html" in value) return (value as { __html: string }).__html ?? "";
	}
	return String(value);
}

export function jsxAttr(k: string, v: unknown): string {
	if (v == null || v === false) return "";
	if (typeof v === "function") return "";

	if (!SAFE_ATTR_RE.test(k)) {
		console.warn("aether:", `refusing to render unsafe attribute: ${k}`);
		return "";
	}

	if (v === true) return k;
	if (k === "style" && typeof v === "object" && v !== null && !Array.isArray(v)) {
		let css = "";
		for (const prop in v as Record<string, string | number>) {
			const val = (v as Record<string, string | number>)[prop];
			if (val == null) continue;
			const key = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
			css += `${key}:${encode(String(val))};`;
		}
		return css ? `style="${css}"` : "";
	}

	return `${k}="${encode(String(v))}"`;
}

export function jsxTemplate(
	template: TemplateStringsArray | string[],
	...values: unknown[]
): string {
	const len = values.length;
	if (len === 0) return template[0];
	let html = template[0];
	for (let i = 0; i < len; i++) {
		html += jsxEscape(values[i]) + template[i + 1];
	}
	return html;
}

export type Component<P extends JSX.Props = JSX.Props> = (props: P) => JSX.Node;

function createTextNode(source: () => unknown): Text {
	const node = document.createTextNode("");
	effect(() => {
		const value = source();
		if (Array.isArray(value) || value instanceof Node) {
			throw new Error(
				"aether: a signal/computed child must resolve to a primitive, not a node or array",
			);
		}
		node.data = String(value ?? "");
	});
	return node;
}

function normaliseChildren(raw: unknown): (Node | string)[] {
	if (raw == null || raw === false || raw === true) return [];
	if (isReactive(raw)) return [createTextNode(raw as () => unknown)];
	if (Array.isArray(raw)) return raw.flatMap(normaliseChildren);
	if (raw instanceof Node) return [raw];
	if (typeof raw === "object") return [];
	return [String(raw)];
}

function applyStyle(el: HTMLElement, value: unknown): void {
	if (typeof value === "string") return void (el.style.cssText = value);
	if (typeof value !== "object" || value === null) return;
	for (const prop in value as Record<string, string | number>) {
		const v = (value as Record<string, string | number>)[prop];
		if (v == null) continue;
		if (prop.startsWith("--")) el.style.setProperty(prop, String(v));
		else (el.style as any)[prop] = String(v);
	}
}

function applyAttribute(el: HTMLElement, key: string, value: unknown): void {
	if (value == null) return;

	if (key === "class") return void (el.className = String(value));
	if (key === "style") return applyStyle(el, value);

	if (key === "href" && el instanceof HTMLAnchorElement) return void (el.href = String(value));

	if (key.length > 2 && key.startsWith("on") && typeof value === "function") {
		el.addEventListener(key[2].toLowerCase() + key.slice(3), value as EventListener);
		return;
	}
	el.setAttribute(key, value === true ? "" : String(value));
}

function bindProp(el: HTMLElement, key: string, value: unknown): void {
	if (value == null) return;
	if (isReactive(value)) {
		return void effect(() => applyAttribute(el, key, (value as () => unknown)()));
	}
	applyAttribute(el, key, value);
}

function buildElement(tag: string, props: JSX.Props): HTMLElement {
	const el = document.createElement(tag);

	for (const key in props) {
		if (key === "children" || key === "dangerouslySetInnerHTML" || key === "key") continue;
		bindProp(el, key, (props as Record<string, unknown>)[key]);
	}

	if (props.dangerouslySetInnerHTML != null) {
		if (props.children != null) {
			throw new Error("aether: cannot use both children and dangerouslySetInnerHTML");
		}
		el.innerHTML = String(props.dangerouslySetInnerHTML.__html);
		return el;
	}

	if (!voidTags.has(tag)) el.append(...normaliseChildren(props.children));
	return el;
}

export function jsx<P extends JSX.Props = JSX.Props>(
	tag: string | Component | typeof Fragment,
	props: P | null = {} as P,
): JSX.Element {
	props ??= {} as P;

	if (tag === Fragment) {
		const frag = document.createDocumentFragment();
		frag.append(...normaliseChildren(props.children));
		return frag;
	}
	if (typeof tag === "function") {
		return tag(props);
	}
	return typeof tag === "string" ? buildElement(tag, props) : null;
}

export { jsx as jsxDEV, jsx as jsxs };

export declare namespace JSX {
	type Element = Node | Node[] | null;

	type FC<P extends Props = Props> = Component<P>;

	interface Props {
		children?: any;
		dangerouslySetInnerHTML?: { __html: string };
		[key: string]: unknown;
	}

	type ElementType = string | FC<any>;

	type Node =
		| string
		| number
		| boolean
		| null
		| undefined
		| globalThis.Node
		| Node[]
		| Signal<unknown>
		| Computed<unknown>
		| (() => unknown);

	interface ElementChildrenAttribute {
		// deno-lint-ignore ban-types
		children: {};
	}

	type IntrinsicAttributes = { key?: string | number };
	type IntrinsicElements = {
		[K in keyof HTMLElementTagNameMap]: {
			[key: string]: unknown;
			style?: string | Record<string, string | number>;
			class?: string;
			children?: any;
			dangerouslySetInnerHTML?: { __html: string };
		};
	};
}
