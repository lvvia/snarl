/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import {
	checkDirty,
	getActiveSub,
	getCycle,
	incrementCycle,
	link,
	pruneChildEffectDeps,
	purgeDeps,
	setActiveSub,
	shallowPropagate,
} from "./engine.ts";
import { tag } from "./tag.ts";
import { HasChildEffect, NodeKind, ReactiveFlags, type ReactiveNode } from "./types.ts";

export interface ComputedNode<T = unknown> extends ReactiveNode {
	readonly kind: NodeKind.Computed;
	value?: T;
	getter: (previousValue?: T) => T;
}

export interface Computed<T> {
	(): T;
}

export function computed<T>(getter: (previousValue?: T) => T): Computed<T> {
	const node: ComputedNode<T> = {
		kind: NodeKind.Computed,
		value: undefined,
		subs: undefined,
		subsTail: undefined,
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.None,
		getter,
	};

	return tag(() => readComputed(node), NodeKind.Computed);
}

export function readComputed<T>(node: ComputedNode<T>): T {
	const flags = node.flags;
	if (
		flags & ReactiveFlags.Dirty ||
		(flags & ReactiveFlags.Pending &&
			(checkDirty(node.deps!, node) || ((node.flags = flags & ~ReactiveFlags.Pending), false)))
	) {
		if (updateComputed(node)) {
			const subs = node.subs;
			if (subs !== undefined) shallowPropagate(subs);
		}
	} else if (!flags) {
		node.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
		const prevSub = setActiveSub(node);
		try {
			node.value = node.getter();
		} finally {
			setActiveSub(prevSub);
			node.flags &= ~ReactiveFlags.RecursedCheck;
		}
	}
	const sub = getActiveSub();
	if (sub !== undefined) link(node, sub, getCycle());
	return node.value!;
}

export function updateComputed<T>(node: ComputedNode<T>): boolean {
	if (node.flags & HasChildEffect) pruneChildEffectDeps(node);
	node.depsTail = undefined;
	node.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;

	const prevSub = setActiveSub(node);
	try {
		incrementCycle();
		const oldValue = node.value;
		return oldValue !== (node.value = node.getter(oldValue));
	} finally {
		setActiveSub(prevSub);
		node.flags &= ~ReactiveFlags.RecursedCheck;
		purgeDeps(node);
	}
}
