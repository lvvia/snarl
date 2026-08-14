/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { abortable } from "@std/async";
import type { Context } from "./context/mod.ts";

/**
 * represents a message sent over server-sent events
 */
export interface SSEMessage {
	/** the event name */
	event?: string;
	/** the data payload */
	data: string;
	/** the event identifier */
	id?: string;
	/** the reconnection time in milliseconds */
	retry?: number;
}

async function* formatSSE(messages: AsyncIterable<SSEMessage> | Iterable<SSEMessage>) {
	const encoder = new TextEncoder();

	for await (const msg of messages) {
		let chunk = "";
		if (msg.event) chunk += `event: ${msg.event}\n`;
		if (msg.id) chunk += `id: ${msg.id}\n`;
		if (msg.retry) chunk += `retry: ${msg.retry}\n`;
		for (const line of msg.data.split("\n")) chunk += `data: ${line}\n`;
		chunk += "\n";

		yield encoder.encode(chunk);
	}
}

/**
 * creates a `Response` that streams server-sent events
 * @param ctx the request context
 * @param source an async iterable or a function returning one
 * @param init optional `ResponseInit` body.
 */
export function sse(
	ctx: Context,
	source: AsyncIterable<SSEMessage> | (() => AsyncIterable<SSEMessage>),
	init?: ResponseInit,
): Response {
	const iterable = typeof source === "function" ? source() : source;
	const stream = ReadableStream.from(
		abortable(formatSSE(iterable), ctx.request.signal),
	);

	return new Response(stream, {
		...init,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			...init?.headers,
		},
	});
}

/**
 * handlers for WebSocket lifecycle events
 */
export interface WebSocketHandler {
	onOpen?: (ws: WebSocket) => void | Promise<void>;
	onMessage?: (ws: WebSocket, event: MessageEvent) => void | Promise<void>;
	onClose?: (ws: WebSocket, event: CloseEvent) => void | Promise<void>;
	onError?: (ws: WebSocket, event: Event | ErrorEvent) => void | Promise<void>;
}

/**
 * upgrades an incoming HTTP connection to a WebSocket connection
 * @param ctx the request context
 * @param handler the WebSocket event handlers
 */
export function upgradeWebSocket(
	ctx: Context,
	handler: WebSocketHandler,
): Response {
	const upgrade = ctx.request.headers.get("upgrade")?.toLowerCase();

	if (!upgrade?.includes("websocket")) {
		return new Response("expected websocket upgrade", {
			status: 426,
			headers: { "Upgrade": "websocket" },
		});
	}

	try {
		const { socket, response } = Deno.upgradeWebSocket(ctx.request);

		if (handler.onOpen) socket.onopen = () => handler.onOpen?.(socket);
		if (handler.onMessage) socket.onmessage = (event) => handler.onMessage?.(socket, event);
		if (handler.onClose) socket.onclose = (event) => handler.onClose?.(socket, event);
		if (handler.onError) socket.onerror = (event) => handler.onError?.(socket, event);

		return response;
	} catch {
		return new Response("Failed to upgrade WebSocket connection", { status: 400 });
	}
}

async function* toUint8Array(source: AsyncIterable<string | Uint8Array>) {
	const encoder = new TextEncoder();
	for await (const chunk of source) {
		yield typeof chunk === "string" ? encoder.encode(chunk) : chunk;
	}
}

/**
 * creates a streaming Response from an async iterable of data
 * @param source an async iterable of strings or Uint8Arrays
 * @param init optional `ResponseInit` body
 */
export function stream(
	ctx: Context,
	source:
		| AsyncIterable<string | Uint8Array>
		| (() => AsyncIterable<string | Uint8Array>),
	init?: ResponseInit,
): Response {
	const iterable = typeof source === "function" ? source() : source;
	const readable = ReadableStream.from(
		abortable(toUint8Array(iterable), ctx.request.signal),
	);

	return new Response(readable, init);
}
