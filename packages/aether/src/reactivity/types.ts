/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import type { ComputedNode } from "./computed.ts";
import type { EffectNode, EffectScopeNode } from "./effect.ts";
import type { SignalNode } from "./signal.ts";

// deno-fmt-ignore
export const enum ReactiveFlags {
	None          = 0,
	Mutable       = 1 << 0,
	Watching      = 1 << 1,
	RecursedCheck = 1 << 2,
	Recursed      = 1 << 3,
	Dirty         = 1 << 4,
	Pending       = 1 << 5,
}

export interface ReactiveNode {
	deps?: Link;
	depsTail?: Link;
	subs?: Link;
	subsTail?: Link;
	flags: ReactiveFlags;
}

export interface Link {
	version: number;
	dep: ReactiveNode;
	sub: ReactiveNode;
	prevSub?: Link;
	nextSub?: Link;
	prevDep?: Link;
	nextDep?: Link;
	prevStack?: Link;
}

// deno-fmt-ignore
export const enum NodeKind {
  Signal      = 0,
  Computed    = 1,
  Effect      = 2,
  EffectScope = 3
}

export type AnyReactiveNode = SignalNode | ComputedNode | EffectNode | EffectScopeNode;

export const HasChildEffect = 1 << 6;

export function isChildEffectLink(node: ReactiveNode): node is EffectNode | EffectScopeNode {
	const kind = (node as AnyReactiveNode).kind;
	return kind === NodeKind.Effect || kind === NodeKind.EffectScope;
}
