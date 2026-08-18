/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { type ComputedNode, updateComputed } from "./computed.ts";
import {
	disposeEffect,
	disposeEffectScope,
	type EffectNode,
	type EffectScopeNode,
	runEffect,
} from "./effect.ts";
import { createReactiveSystem } from "./graph.ts";
import { type SignalNode, updateSignal } from "./signal.ts";
import {
	type AnyReactiveNode,
	isChildEffectLink,
	NodeKind,
	ReactiveFlags,
	type ReactiveNode,
} from "./types.ts";

let cycle = 0;
let runDepth = 0;
let batchDepth = 0;
let notifyIndex = 0;
let queuedLength = 0;
let activeSub: ReactiveNode | undefined;

const queued: (EffectNode | undefined)[] = [];

type ReactiveFn = (_: AnyReactiveNode) => boolean;

export const { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
	update: update as ReactiveFn,
	notify: notify as ReactiveFn,
	unwatched: unwatched as ReactiveFn,
});

export function getActiveSub(): ReactiveNode | undefined {
	return activeSub;
}

export function setActiveSub(sub?: ReactiveNode): ReactiveNode | undefined {
	const prev = activeSub;
	activeSub = sub;
	return prev;
}

export function getCycle(): typeof cycle {
	return cycle;
}

export function incrementCycle(): typeof cycle {
	return ++cycle;
}

export function getRunDepth(): typeof runDepth {
	return runDepth;
}

export function incrementRunDepth(): typeof runDepth {
	return ++runDepth;
}

export function decrementRunDepth(): typeof runDepth {
	return --runDepth;
}

export function getBatchDepth(): number {
	return batchDepth;
}

export function startBatch(): void {
	++batchDepth;
}

export function endBatch(): void {
	if (!--batchDepth) flush();
}

function update(node: SignalNode | ComputedNode | EffectScopeNode): boolean {
	switch (node.kind) {
		case NodeKind.Computed:
			return updateComputed(node);
		case NodeKind.Signal:
			return updateSignal(node);
		default:
			node.flags = ReactiveFlags.Mutable;
			return true;
	}
}

function notify(effect: EffectNode): void {
	let insertIndex = queuedLength;
	const firstInsertedIndex = insertIndex;

	do {
		queued[insertIndex++] = effect;
		effect.flags &= ~ReactiveFlags.Watching;
		effect = effect.subs?.sub as EffectNode;
		if (effect === undefined || !(effect.flags & ReactiveFlags.Watching)) break;
	} while (true);

	queuedLength = insertIndex;

	let lo = firstInsertedIndex, hi = insertIndex - 1;
	while (lo < hi) {
		const tmp = queued[lo];
		queued[lo++] = queued[hi];
		queued[hi--] = tmp;
	}
}

const disposalWorklist: ReactiveNode[] = [];
let disposalWorklistActive = false;

function unwatched(node: SignalNode | ComputedNode | EffectNode | EffectScopeNode): void {
	switch (node.kind) {
		case NodeKind.Computed:
			if (node.depsTail !== undefined) {
				node.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
				disposeAllDepsInReverse(node);
			}
			return;
		case NodeKind.Signal:
			return;
		case NodeKind.Effect:
			disposeEffect(node);
			return;
		case NodeKind.EffectScope:
			disposeEffectScope(node);
			return;
	}
}

export function trigger(fn: () => void): void {
	const sub: ReactiveNode = {
		deps: undefined,
		depsTail: undefined,
		flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
	};

	const prevSub = setActiveSub(sub);
	++batchDepth;
	try {
		fn();
	} finally {
		activeSub = prevSub;
		sub.flags = ReactiveFlags.None;

		let edge = sub.deps;
		while (edge !== undefined) {
			const dep = edge.dep;
			edge = unlink(edge, sub);
			const subs = dep.subs;
			if (subs !== undefined) {
				propagate(subs, !!runDepth);
				shallowPropagate(subs);
			}
		}
		if (!--batchDepth) flush();
	}
}

export function flush(): void {
	try {
		while (notifyIndex < queuedLength) {
			const effect = queued[notifyIndex]!;
			queued[notifyIndex++] = undefined;
			runEffect(effect);
		}
	} finally {
		while (notifyIndex < queuedLength) {
			const effect = queued[notifyIndex]!;
			queued[notifyIndex++] = undefined;
			effect.flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed;
		}
		notifyIndex = 0;
		queuedLength = 0;
	}
}

export function pruneChildEffectDeps(node: ReactiveNode): void {
	let edge = node.depsTail;
	while (edge !== undefined) {
		const prev = edge.prevDep;
		if (isChildEffectLink(edge.dep)) unlink(edge, node);
		edge = prev;
	}
}

export function disposeAllDepsInReverse(node: ReactiveNode): void {
	if (disposalWorklistActive) {
		disposalWorklist.push(node);
		return;
	}

	disposalWorklistActive = true;
	try {
		let current: ReactiveNode | undefined = node;
		while (current !== undefined) {
			let edge = current.depsTail;
			while (edge !== undefined) {
				const prev = edge.prevDep;
				unlink(edge, current);
				edge = prev;
			}
			current = disposalWorklist.pop();
		}
	} finally {
		disposalWorklistActive = false;
		disposalWorklist.length = 0;
	}
}

export function purgeDeps(node: ReactiveNode): void {
	const depsTail = node.depsTail;
	let edge = depsTail !== undefined ? depsTail.nextDep : node.deps;
	while (edge !== undefined) {
		edge = unlink(edge, node);
	}
}

export function untracked<T>(fn: () => T): T {
	const prevSub = setActiveSub(undefined);
	try {
		return fn();
	} finally {
		setActiveSub(prevSub);
	}
}
