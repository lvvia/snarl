/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { css, signal } from "@404/aether";

const Styled = css`
	:scope {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.counter-text {
		display: inline-flex;
		align-items: center;
		background: #1e1e2e;
		color: #cdd6f4;
		gap: 0.4em;
		font-weight: 500;
		font-size: 1.1rem;
		height: 2.25rem;
		min-width: 180px;
		justify-content: center;
		border-radius: 8px;
	}

	.inline-gif {
		height: 1.1em;
		width: 1.1em;
		object-fit: contain;
	}

	.btn {
		background: #313244;
		color: #cdd6f4;
		border: none;
		border-radius: 8px;
		width: 2.25rem;
		height: 2.25rem;
		font-size: 1.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s, transform 0.1s;
	}

	.btn:hover {
		background: #45475a;
	}

	.btn:active {
		transform: scale(0.95);
	}

	.btn-reset {
		width: auto;
		padding: 0 0.75rem;
		font-size: 0.9rem;
		background: #1e1e2e;
		border: 1px solid #45475a;
	}

	.btn-reset:hover {
		background: rgba(255, 255, 255, 0.05);
	}
`;

export default function Counter({ initial = 0 }: { initial?: number }) {
	const count = signal(initial);

	const decrement = () => count.value--;
	const increment = () => count.value++;
	const reset = () => (count.value = initial);

	// reactive comparison. see the docs on `.map()` for why this can't
	// be written as `{count > 10 ? "high" : "low"}` directly
	const label = count.map((n) => n > 10 ? "high" : n < 0 ? "negative" : "low");

	return (
		<Styled.div>
			<button class="btn" type="button" onClick={decrement}>−</button>
			<span class="counter-text">
				count is {count} ({label})
				<img
					class="inline-gif"
					src="https://cdn.discordapp.com/emojis/1397548765316907069.webp?size=256&animated=true"
					alt="icon"
				/>
			</span>
			<button class="btn" type="button" onClick={increment}>+</button>
			<button class="btn btn-reset" type="button" onClick={reset}>reset</button>
		</Styled.div>
	);
}
