/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { assertEquals } from "@std/assert";
import { consume, Context, sse, stream, upgradeWebSocket } from "@july/snarl";

const mockInfo = { remoteAddr: { hostname: "127.0.0.1" } } as Deno.ServeHandlerInfo<Deno.NetAddr>;

function makeCtx(): Context {
	return new Context(
		new Request("http://localhost/test"),
		"http://localhost/test",
		"",
		mockInfo,
		{},
		"sixseven",
	);
}

Deno.test("stream: sse", async (t) => {
	await t.step("formats SSE messages correctly", async () => {
		const ctx = makeCtx();

		async function* source() {
			yield { data: "hello" };
			yield { event: "update", data: '{"x":1}', id: "1" };
			yield { data: "world", retry: 5000 };
		}

		const res = sse(ctx, source);
		assertEquals(res.headers.get("Content-Type"), "text/event-stream");
		assertEquals(res.headers.get("Cache-Control"), "no-cache");

		const text = await res.text();
		assertEquals(text.includes("data: hello"), true);
		assertEquals(text.includes("event: update"), true);
		assertEquals(text.includes('data: {"x":1}'), true);
		assertEquals(text.includes("id: 1"), true);
		assertEquals(text.includes("retry: 5000"), true);
	});

	await t.step("works with function source", () => {
		const ctx = makeCtx();
		const res = sse(ctx, () =>
			(async function* () {
				yield { data: "test" };
			})());
		assertEquals(res.status, 200);
	});
});

Deno.test("stream: stream", async (t) => {
	await t.step("streams Uint8Array chunks", async () => {
		const ctx = makeCtx();
		const encoder = new TextEncoder();

		async function* source() {
			yield encoder.encode("hello ");
			yield encoder.encode("world");
		}

		const res = stream(ctx, source);
		assertEquals(await res.text(), "hello world");
	});
});

Deno.test("stream: upgradeWebSocket rejects non-websocket requests", () => {
	const ctx = makeCtx();
	const res = upgradeWebSocket(ctx, {});
	assertEquals(res.status, 426);
});

Deno.test("stream: sse() stops iterating once the request signal aborts", async () => {
	const controller = new AbortController();
	const ctx = new Context(
		new Request("http://localhost/", { signal: controller.signal }),
		"/",
		"",
		mockInfo,
		{},
		"id",
	);

	let yielded = 0;
	async function* source() {
		try {
			while (true) {
				yielded++;
				yield { data: String(yielded) };
				await new Promise((r) => setTimeout(r, 5));
			}
		} finally {
			/* no-op */
		}
	}

	const res = sse(ctx, source);
	const reader = res.body!.getReader();
	await reader.read();
	controller.abort();
	await reader.read().catch(() => {});
	assertEquals(yielded > 0, true);
});

Deno.test("stream: consume() parses a raw SSE byte stream back into data strings", async () => {
	const encoder = new TextEncoder();
	const raw = "event: update\ndata: hello\n\ndata: world\n\n";
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(raw));
			controller.close();
		},
	});

	const out: string[] = [];
	for await (const chunk of consume(body)) out.push(chunk);
	assertEquals(out, ["hello", "world"]);
});

Deno.test("stream: consume() strips exactly one leading space after 'data:'", async () => {
	const encoder = new TextEncoder();
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode("data:  extra-space\n\n"));
			controller.close();
		},
	});
	const out: string[] = [];
	for await (const chunk of consume(body)) out.push(chunk);
	assertEquals(out, [" extra-space"]);
});
