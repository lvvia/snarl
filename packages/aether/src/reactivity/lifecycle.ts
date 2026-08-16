/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { effect } from "./effect.ts";
import { isBrowser } from "../env.ts";

/**
 * registers `fn` to run once the surrounding island is mounted in the
 * browser
 */
export function onMount(fn: () => void | (() => void)): void {
	if (!isBrowser) return;
	effect(fn);
}
