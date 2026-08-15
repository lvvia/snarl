/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { boring } from "@404/imouto";
import { fromFileUrl, join } from "@std/path";
import { getIslandModuleUrl } from "./registry.ts";

import * as esbuild from "esbuild";

export interface AetherServeOptions {
	/** in-memory cache for bundled islands. defaults to a shared `Map` */
	cache?: Map<string, string>;
	/** extra esbuild plugins merged after the aether resolver */
	plugins?: esbuild.Plugin[];
	/** override the jsx runtime used for the client bundle */
	jsxImportSource?: string;
}

const AETHER_SRC_ROOT = fromFileUrl(new URL("../", import.meta.url));

class UnsupportedExportError extends Error {
	constructor(exportName: string) {
		super(`The export "${exportName}" is not supported in this environment.`);
		this.name = "UnsupportedExportError";
	}
}

const KNOWN_EXPORTS: Record<string, string | (() => never)> = {
	"@404/aether": "mod.ts",
	"@july/snarl/jsx-runtime": "jsx-runtime.ts",
	"@july/snarl/jsx-dev-runtime": "jsx-runtime.ts",
	"@404/aether/jsx-runtime": "jsx-runtime.ts",
	"@404/aether/jsx-dev-runtime": "jsx-runtime.ts",
	"@404/aether/client": "client/mod.ts",
	"@404/aether/client/runtime": "client/runtime.ts",
	"@404/aether/client/jsx-runtime": "client/jsx.ts",
	"@404/aether/client/jsx-dev-runtime": "client/jsx.ts",
	"@404/aether/reactivity": "reactivity/mod.ts",
	"@404/aether/server": () => {
		throw new UnsupportedExportError("@404/aether/server");
	},
};

/** resolves `@404/aether/*` to real source paths so esbuild can bundle them */
function aetherResolver(): esbuild.Plugin {
	return {
		name: "aether-resolver",
		setup(build) {
			build.onResolve({ filter: /^(?:@404\/aether|@july\/snarl)(\/|$)/ }, (args) => {
				const rel = KNOWN_EXPORTS[args.path];
				if (!rel) return { path: args.path, external: true };

				return {
					path: join(AETHER_SRC_ROOT, typeof rel === "string" ? rel : rel()),
				};
			});
		},
	};
}

export async function bundleIslands(
	names: readonly string[],
	options: AetherServeOptions,
): Promise<string> {
	const source = buildEntrySource(names);

	const result = await esbuild.build({
		stdin: {
			contents: source,
			resolveDir: Deno.cwd(),
			loader: "ts",
			sourcefile: `aether-entry-${boring(source)}.ts`,
		},
		bundle: true,
		write: false,
		format: "esm",
		platform: "browser",
		target: "es2022",
		jsx: "automatic",
		jsxImportSource: options.jsxImportSource ?? "@404/aether/client",
		plugins: [aetherResolver(), ...(options.plugins ?? [])],
		minify: Deno.env.get("ENV") === "production",
		treeShaking: true,
		logLevel: "warning",
	});

	if (result.errors.length) {
		throw new Error(`aether: bundle failed\n${result.errors.map((e) => e.text).join("\n")}`);
	}
	return result.outputFiles![0].text;
}

function buildEntrySource(names: readonly string[]): string {
	const lines = [`import { registerIsland, hydrate } from "@404/aether/client";`];

	names.forEach((name, i) => {
		const specifier = getIslandModuleUrl(name);
		if (!specifier) {
			throw new Error(`aether: no island registered under name "${name}"`);
		}

		const path = fromFileUrl(specifier);
		lines.push(`import island${i} from ${JSON.stringify(path)};`);
		lines.push(`registerIsland(${JSON.stringify(name)}, island${i});`);
	});

	lines.push(`hydrate();`);
	return lines.join("\n");
}

export function encodeEntryKey(names: Iterable<string>): string {
	return [...new Set(names)].sort().map(encodeURIComponent).join(",");
}
