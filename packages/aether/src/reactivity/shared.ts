import { type Signal, signal } from "./signal.ts";

const registry = new Map<string, Signal<any>>();

/**
 * a signal shared *by name* across independently-hydrated islands.
 * Every island that calls `sharedSignal("cart-count", 0)` gets back the
 * *same* signal instance, so a write in one island is visible.
 *
 * @param key stable identifier shared by every island that wants the
 * same value.
 *
 * @example
 * ```tsx
 * // island A: an "add to cart" button
 * const count = sharedSignal("cart-count", 0);
 * <button onClick={() => count.update((n) => n + 1)}>Add</button>
 *
 * // island B: a header badge, hydrated completely separately
 * const count = sharedSignal("cart-count", 0);
 * <span>{count}</span>
 * ```
 */
export function sharedSignal<T>(key: string, initial: T): Signal<T> {
	let sig = registry.get(key);
	if (!sig) registry.set(key, sig = signal(initial));
	return sig;
}
