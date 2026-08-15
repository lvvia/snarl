/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { boring } from "@404/imouto/hash";
import { jsx } from "./jsx.ts";
import type { JSX } from "./jsx.ts";

export interface ScopedStyles {
	readonly id: string;
	toString(): string;

	use(): void;
}

export type ScopedComponent = (props: Record<string, unknown>) => JSX.Element;

export type StyledFactory = Record<
	string,
	(strings: TemplateStringsArray, ...values: unknown[]) => ScopedComponent
>;

export type ScopedStyleSheet =
	& ScopedStyles
	& Record<string, ScopedComponent>
	& { readonly styled: StyledFactory };

function templateToSource(strings: TemplateStringsArray, values: unknown[]): string {
	return strings.reduce<string>((acc, str, i) => acc + str + (values[i] ?? ""), "").trim();
}

function createComponent(tag: string, scope: string): ScopedComponent {
	return function TagComponent(props: Record<string, unknown> = {}) {
		const { class: className, ...rest } = props;
		return jsx(tag, {
			...rest,
			class: className ? `${scope ? `${scope} ` : ""}${className}` : scope,
		}) as JSX.Element;
	};
}

function createScopedStyles(src: string): ScopedStyleSheet {
	const scope = boring(src);

	const styledFactory = new Proxy({} as StyledFactory, {
		get(_target, property: string) {
			const tag = property.toLowerCase();
			return (strings: TemplateStringsArray, ...values: unknown[]) => {
				const combined = `${src} ${templateToSource(strings, values)}`;
				return createComponent(tag, boring(combined));
			};
		},
	});

	return new Proxy(
		{ id: scope, toString: () => scope, use: () => {}, styled: styledFactory },
		{
			get(target, tag: string) {
				if (tag in target) return (target as any)[tag];
				return createComponent(tag, scope);
			},
		},
	) as ScopedStyleSheet;
}

export interface CssTag {
	(strings: TemplateStringsArray, ...values: unknown[]): ScopedStyleSheet;
}

export const css: CssTag = (strings, ...values) =>
	createScopedStyles(templateToSource(strings, values));

export const styled: StyledFactory = new Proxy({} as StyledFactory, {
	get(_target, property: string) {
		const tag = property.toLowerCase();
		return (strings: TemplateStringsArray, ...values: unknown[]) => {
			const src = templateToSource(strings, values);
			return createComponent(tag, boring(src));
		};
	},
});
