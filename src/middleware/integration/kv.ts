/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

/// <reference lib="deno.unstable" />

import type { RateLimitStore } from "../rate-limit.ts";

interface KvEntry {
	count: number;
	reset: number;
}

/**
 * `Deno.Kv`-backed implementation of `RateLimitStore`, for rate limits that
 * need to survive restarts or be shared across isolates/instances.
 *
 * requires the `--unstable-kv` flag (or a Deno version where Kv has stabilised).
 *
 * @example
 * ```ts
 * const kv = await Deno.openKv();
 * app.use(rateLimit({ windowMs: 60_000, max: 100, store: new KvStore(kv) }));
 * ```
 */
export class KvStore implements RateLimitStore {
	constructor(
		private readonly kv: Deno.Kv,
		private readonly prefix: Deno.KvKeyPart[] = ["ratelimit"],
	) {}

	async increment(key: string, windowMs: number): Promise<KvEntry> {
		const key$kv: Deno.KvKey = [...this.prefix, key];
		const now = Date.now();

		const existing = await this.kv.get<KvEntry>(key$kv);

		if (existing.value && now <= existing.value.reset) {
			const next: KvEntry = {
				count: existing.value.count + 1,
				reset: existing.value.reset,
			};

			const expireIn = Math.max(0, next.reset - now);

			const result = await this.kv.atomic()
				.check(existing)
				.set(key$kv, next, { expireIn })
				.commit();

			if (!result.ok) {
				const fresh = await this.kv.get<KvEntry>(key$kv);
				return fresh.value ?? { count: 1, reset: now + windowMs };
			}

			return next;
		} else {
			const next: KvEntry = { count: 1, reset: now + windowMs };

			const result = await this.kv.atomic()
				.check(existing)
				.set(key$kv, next, { expireIn: windowMs })
				.commit();

			if (!result.ok) {
				const fresh = await this.kv.get<KvEntry>(key$kv);
				return fresh.value ?? next;
			}
			return next;
		}
	}

	async cleanup(): Promise<void> {
		const entries = this.kv.list<KvEntry>({ prefix: this.prefix });
		const atomic = this.kv.atomic();
		let hasItems = false;

		for await (const entry of entries) {
			atomic.delete(entry.key);
			hasItems = true;
		}

		if (hasItems) {
			await atomic.commit();
		}
	}
}
