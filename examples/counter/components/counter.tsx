/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { signal } from "@404/aether/reactivity";

export default function Counter({ initial = 0 }: { initial?: number }) {
	const count = signal(initial);
	return (
		<button
			type="button"
			onClick={() => {
				console.log("🖱️ Clicked!");
				count(count() + 1);
			}}
		>
			count is {count}
		</button>
	);
}
