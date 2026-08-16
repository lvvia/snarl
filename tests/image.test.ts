/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { assertEquals } from "@std/assert";
import { Context, detectImageType, processImageBlob, processImageStream } from "@july/snarl";

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

Deno.test("detectImageType: PNG magic bytes", () => {
	const png = hexToBytes("89504e470d0a1a0a0000000d49484452");
	assertEquals(detectImageType(png), "image/png");
});

Deno.test("detectImageType: JPEG magic bytes", () => {
	const jpeg = hexToBytes("ffd8ffe000104a464946");
	assertEquals(detectImageType(jpeg), "image/jpeg");
});

Deno.test("detectImageType: GIF magic bytes", () => {
	const gif = hexToBytes("474946383961");
	assertEquals(detectImageType(gif), "image/gif");
});

// deno-fmt-ignore
Deno.test("detectImageType: WebP container detection", () => {
  const riff = new Uint8Array(16);

  riff[0] = 0x52; riff[1] = 0x49; riff[2] = 0x46; riff[3] = 0x46; 
  riff[8] = 0x57; riff[9] = 0x45; riff[10] = 0x42; riff[11] = 0x50; 

  assertEquals(detectImageType(riff), "image/webp");
});

// deno-fmt-ignore
Deno.test("detectImageType: AVIF container detection", () => {
  const avif = new Uint8Array(16);

  avif[4] = 0x66; avif[5] = 0x74; avif[6] = 0x79; avif[7] = 0x70;
  avif[8] = 0x61; avif[9] = 0x76; avif[10] = 0x69; avif[11] = 0x66;

  assertEquals(detectImageType(avif), "image/avif");
});

// deno-fmt-ignore
Deno.test("detectImageType: JPEG XL container detection", () => {
  const jxl = new Uint8Array(12);

  jxl[4] = 0x4A; jxl[5] = 0x58; jxl[6] = 0x4C; jxl[7] = 0x20;

  assertEquals(detectImageType(jxl), "image/jxl");
});

Deno.test("detectImageType: BMP magic bytes", () => {
	const bmp = hexToBytes("424d");
	assertEquals(detectImageType(bmp), "image/bmp");
});

Deno.test("detectImageType: ICO magic bytes", () => {
	const ico = hexToBytes("00000100");
	assertEquals(detectImageType(ico), "image/x-icon");
});

Deno.test("detectImageType: SVG detection from <svg> tag", () => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
	const bytes = new TextEncoder().encode(svg);
	assertEquals(detectImageType(bytes), "image/svg+xml");
});

Deno.test("detectImageType: SVG detection from XML with SVG namespace", () => {
	const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>`;
	const bytes = new TextEncoder().encode(svg);
	assertEquals(detectImageType(bytes), "image/svg+xml");
});

Deno.test("detectImageType: returns undefined for unknown formats", () => {
	const unknown = new TextEncoder().encode("plain text");
	assertEquals(detectImageType(unknown), undefined);
});

Deno.test("detectImageType: returns undefined for empty data", () => {
	assertEquals(detectImageType(new Uint8Array()), undefined);
});

Deno.test("processImageStream: preserves full stream and detects type", async () => {
	const data = new TextEncoder().encode("<svg>test</svg>");
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});

	const result = await processImageStream(stream);
	assertEquals(result.mime, "image/svg+xml");

	const reader = result.stream.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const meow = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		meow.set(chunk, offset);
		offset += chunk.length;
	}
	assertEquals(meow, data);
});

Deno.test("processImageStream: handles empty stream gracefully", async () => {
	const stream = new ReadableStream({
		start(controller) {
			controller.close();
		},
	});
	const result = await processImageStream(stream);
	assertEquals(result.mime, "application/octet-stream");
	const reader = result.stream.getReader();

	const { done, value } = await reader.read();

	assertEquals(done, true);
	assertEquals(value, undefined);
});

Deno.test("processImageStream: uses fallback when detection fails", async () => {
	const data = new TextEncoder().encode("plain text with no magic");
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});
	const result = await processImageStream(stream);
	assertEquals(result.mime, "application/octet-stream");
});

Deno.test("processImageBlob: detects SVG from Blob", async () => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
	const blob = new Blob([svg], { type: "text/plain" });
	const result = await processImageBlob(blob);
	assertEquals(result.mime, "image/svg+xml");
	const text = await result.bytes.text();
	assertEquals(text, svg);
});

Deno.test("processImageBlob: falls back to blob.type if detection fails", async () => {
	const blob = new Blob(["plain text"], { type: "image/custom" });
	const result = await processImageBlob(blob);
	assertEquals(result.mime, "image/custom");
});

Deno.test("processImageBlob: uses application/octet-stream as ultimate fallback", async () => {
	const blob = new Blob(["plain text"], { type: "" });
	const result = await processImageBlob(blob);
	assertEquals(result.mime, "application/octet-stream");
});

Deno.test("Context.image: sends image with auto-detected content type", async () => {
	const mockInfo = { remoteAddr: { hostname: "127.0.0.1" } } as Deno.ServeHandlerInfo<Deno.NetAddr>;

	const ctx = new Context(
		new Request("http://localhost/test"),
		"/test",
		"",
		mockInfo,
		{},
		"id",
	);

	const pngBytes = hexToBytes("89504e470d0a1a0a0000000d49484452");
	const res = await ctx.image(pngBytes);
	assertEquals(res.headers.get("Content-Type"), "image/png");
	const body = await res.arrayBuffer();
	assertEquals(new Uint8Array(body), pngBytes);
});

Deno.test("Context.image: handles Blob input", async () => {
	const mockInfo = { remoteAddr: { hostname: "127.0.0.1" } } as Deno.ServeHandlerInfo<Deno.NetAddr>;

	const ctx = new Context(
		new Request("http://localhost/test"),
		"/test",
		"",
		mockInfo,
		{},
		"id",
	);

	const svg = `<svg xmlns="http://www.w3.org/2000/svg"/>`;
	const blob = new Blob([svg]);
	const res = await ctx.image(blob);
	assertEquals(res.headers.get("Content-Type"), "image/svg+xml");
	const text = await res.text();
	assertEquals(text, svg);
});
