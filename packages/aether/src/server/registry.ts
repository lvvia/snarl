/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { boring, getContext } from "@404/imouto";

export interface IslandMeta {
	id: string;
	moduleUrl: string;
	exportName: string;
	Component: (...args: any[]) => unknown;
}

// deno-lint-ignore ban-types
const byComponent = new Map<Function, IslandMeta>();
const byId = new Map<string, IslandMeta>();

const USED_ISLANDS = Symbol.for("aether.used-islands");

export function generateIslandId(moduleUrl: string, exportName: string): string {
	return boring(`${moduleUrl}:${exportName}`);
}

export function registerIslandComponent(
	// deno-lint-ignore ban-types
	Component: Function,
	moduleUrl: string,
	exportName = "default",
	id: string = generateIslandId(moduleUrl, exportName),
): IslandMeta {
	const existingById = byId.get(id);
	if (existingById) {
		if (existingById.Component !== Component || existingById.moduleUrl !== moduleUrl) {
			throw new Error(
				`aether: island id "${id}" is already registered from a different component/module`,
			);
		}
		return existingById;
	}

	const existingByComponent = byComponent.get(Component);
	if (existingByComponent) return existingByComponent;

	const meta: IslandMeta = {
		id,
		moduleUrl,
		exportName,
		Component: Component as IslandMeta["Component"],
	};

	byId.set(id, meta);
	byComponent.set(Component, meta);

	return meta;
}

export function getIslandMeta(value: unknown): IslandMeta | undefined {
	return typeof value === "function" ? byComponent.get(value) : undefined;
}

export function getIslandMetaById(id: string): IslandMeta | undefined {
	return byId.get(id);
}

export function getIslandModuleUrl(id: string): string | undefined {
	return byId.get(id)?.moduleUrl;
}

export function getIslandExportName(id: string): string {
	return byId.get(id)?.exportName ?? "default";
}

export function markIslandUsed(id: string): void {
	const ctx = getContext();
	if (!ctx) return;

	let used = ctx.state.get(USED_ISLANDS) as Set<string> | undefined;
	if (!used) {
		used = new Set();
		ctx.state.set(USED_ISLANDS, used);
	}

	used.add(id);
}

export function getUsedIslands(
	ctx?: { state?: Map<string | symbol, unknown> },
): ReadonlySet<string> | undefined {
	const target = ctx ?? getContext();
	if (!target?.state) return undefined;
	return target.state.get(USED_ISLANDS) as ReadonlySet<string> | undefined;
}
