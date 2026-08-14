#!/usr/bin/env -S deno run --allow-read
/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { expandGlob } from "@std/fs/expand-glob";
import { dirname, join, relative } from "@std/path";

interface PackageInfo {
	name: string;
	path: string;
	entry: string;
}

function resolveEntry(exports: unknown): string {
	if (typeof exports === "string") return exports;
	if (exports && typeof exports === "object" && "." in exports) {
		const main = (exports as Record<string, unknown>)["."];
		if (typeof main === "string") return main;
	}
	return "src/mod.ts";
}

async function discover() {
	const packages: PackageInfo[] = [];

	const text = await Deno.readTextFile("./deno.json");
	const rootConfig = JSON.parse(text);
	if (rootConfig.name) {
		packages.push({
			name: rootConfig.name,
			path: ".",
			entry: resolveEntry(rootConfig.exports),
		});
	}

	const workspacePatterns = rootConfig.workspace ?? [];
	for (const pattern of workspacePatterns) {
		const globPattern = join(pattern, "deno.json");

		for await (const entry of expandGlob(globPattern)) {
			if (!entry.isFile) continue;

			const text = await Deno.readTextFile(entry.path);
			const config = JSON.parse(text);

			if (config.name) {
				const absoluteDir = dirname(entry.path);
				const relativePath = relative(Deno.cwd(), absoluteDir);
				const entryFile = resolveEntry(config.exports);

				packages.push({
					name: config.name,
					path: relativePath,
					entry: join(relativePath, entryFile),
				});
			}
		}
	}

	console.log(JSON.stringify(packages));
}

discover();
