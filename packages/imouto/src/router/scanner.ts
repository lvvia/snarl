/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { join } from "@std/path";
import { toFileUrl } from "@std/path";
import { dim } from "@std/fmt/colors";
import { applySpecialFile } from "./special-files.ts";
import { makeRoutePath } from "./paths.ts";
import type { RootRouteMetadata, ScanEntry } from "./types.ts";

interface DirListing {
	subdirs: string[];
	routes: string[];
	special: string[];
}

async function listDir(root: string): Promise<DirListing> {
	const subdirs: string[] = [], routes: string[] = [], special: string[] = [];

	for await (const entry of Deno.readDir(root)) {
		const file = join(root, entry.name);
		if (entry.isDirectory) {
			subdirs.push(file);
			continue;
		}
		if (!entry.name.match(/\.tsx?$/)) continue;
		(entry.name.startsWith("_") ? special : routes).push(file);
	}
	return { subdirs, routes, special };
}

async function importRoute(base: string, file: string, verbose: boolean): Promise<ScanEntry> {
	const rel = file.slice(base.length + 1);
	const start = performance.now();
	const module = await import(toFileUrl(file).href);

	if (verbose) console.log(dim(`  ↓ imported ${rel} in ${(performance.now() - start).toFixed(2)}ms`));
	return { path: makeRoutePath(rel), fsPath: file, module, depth: rel.split("/").length - 1 };
}

export async function scanDir(
	base: string,
	root: string,
	entries: ScanEntry[],
	metas: Map<string, RootRouteMetadata>,
	verbose: boolean,
): Promise<void> {
	const meta: RootRouteMetadata = { middlewares: [] };
	metas.set(root, meta);

	const { subdirs, routes, special } = await listDir(root);

	await Promise.all(special.map((file) => applySpecialFile(meta, file)));
	entries.push(...await Promise.all(routes.map((file) => importRoute(base, file, verbose))));

	for (const dir of subdirs) await scanDir(base, dir, entries, metas, verbose);
}
