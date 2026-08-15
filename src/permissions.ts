/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { log } from "@july/snarl/verbosity";

export interface PermissionRequirement {
	descriptor: Deno.PermissionDescriptor;

	/** human-readable reason shown if denied */
	reason: string;
}

export interface PreflightOptions {
	/** if a request is denied, throw instead of just logging. defaults to `true` */
	strict?: boolean;
}

/**
 * requests every listed permission up front, before the server starts
 * handling requests, so the person is never interrupted mid-request by
 * a permission prompt they weren't expecting.
 *
 * @example
 * ```ts
 * await preflightPermissions([
 *   { descriptor: { name: "net" }, reason: "to accept incoming connections" },
 *   { descriptor: { name: "read", path: "./static" }, reason: "to serve static files" },
 * ]);
 * ```
 */
export async function preflightPermissions(
	requirements: PermissionRequirement[],
	options: PreflightOptions = {},
): Promise<void> {
	const { strict = true } = options;

	requirements = dedupe(requirements);
	const denied: PermissionRequirement[] = [];

	for (const req of requirements) {
		const status = await Deno.permissions.request(req.descriptor);
		if (status.state !== "granted") denied.push(req);
	}

	if (!denied.length) return;

	const summary = denied.map((d) => `  · ${describe(d.descriptor)} — ${d.reason}`).join("\n");
	const message = `snarl: missing permissions:\n${summary}`;

	if (strict) throw new Error(message);
	log.warn(message);
}

function describe(d: Deno.PermissionDescriptor): string {
	if (d.name === "read" || d.name === "write") {
		return `filesystem ${d.name}${"path" in d ? ` (${d.path})` : ""}`;
	}
	if (d.name === "net") return `network${"host" in d && d.host ? ` (${d.host})` : ""}`;
	if (d.name === "run") return `run command${"command" in d ? ` (${d.command})` : ""}`;
	if (d.name === "env") {
		return `access environment variables${"variable" in d ? ` (${d.variable})` : ""}`;
	}
	return d.name;
}

function dedupe(reqs: PermissionRequirement[]): PermissionRequirement[] {
	const seen = new Set<string>();
	const out: PermissionRequirement[] = [];
	for (const req of reqs) {
		const key = JSON.stringify(req.descriptor);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(req);
	}
	return out;
}
