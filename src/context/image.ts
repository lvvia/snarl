/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { concatReadableStreams } from "@std/streams/concat-readable-streams";
import { LimitedBytesTransformStream } from "@std/streams/limited-bytes-transform-stream";
import { toBytes } from "@std/streams/to-bytes";

const IMAGE_MAGIC: Record<string, [number[], string]> = {
	png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], "image/png"],
	jpeg: [[0xFF, 0xD8, 0xFF], "image/jpeg"],
	gif: [[0x47, 0x49, 0x46, 0x38], "image/gif"],
	jxl: [[0xFF, 0x0A], "image/jxl"],
	bmp: [[0x42, 0x4D], "image/bmp"],
	ico: [[0x00, 0x00, 0x01, 0x00], "image/x-icon"],
};

function matchFixedMagic(data: Uint8Array, len: number): string | undefined {
	for (const [magic, mime] of Object.values(IMAGE_MAGIC)) {
		if (len >= magic.length && magic.every((b, i) => data[i] === b)) {
			return mime;
		}
	}
	return undefined;
}

function matchContainerMagic(data: Uint8Array, len: number): string | undefined {
	if (len < 12) return undefined;

	if (
		data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
		data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
	) {
		return "image/webp";
	}

	if (
		data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70 &&
		data[8] === 0x61 && data[9] === 0x76 && data[10] === 0x69 && data[11] === 0x66
	) {
		return "image/avif";
	}

	if (data[4] === 0x4A && data[5] === 0x58 && data[6] === 0x4C && data[7] === 0x20) {
		return "image/jxl";
	}

	return undefined;
}

function matchSvgText(data: Uint8Array, len: number): string | undefined {
	const previewLen = Math.min(len, 512);
	const preview = new TextDecoder("utf-8", { fatal: false }).decode(data.subarray(0, previewLen));

	if (/<svg\b/i.test(preview) || (preview.includes("<?xml") && /svg\b/i.test(preview))) {
		return "image/svg+xml";
	}
	return undefined;
}

export function detectImageType(data: Uint8Array): string | undefined {
	const len = data.length;
	if (len === 0) return undefined;

	return (
		matchFixedMagic(data, len) ||
		matchContainerMagic(data, len) ||
		matchSvgText(data, len)
	);
}

export async function processImageStream(
	stream: ReadableStream<Uint8Array>,
): Promise<{ stream: ReadableStream<Uint8Array>; mime: string }> {
	const limitedStream = stream.pipeThrough(new LimitedBytesTransformStream(512, { error: false }));
	const hd = await toBytes(limitedStream);

	const mime = detectImageType(hd) || "application/octet-stream";
	if (hd.length === 0) {
		return { stream, mime };
	}

	const header = new ReadableStream({
		start(controller) {
			controller.enqueue(hd);
			controller.close();
		},
	});

	return { stream: concatReadableStreams(header, stream), mime };
}

export async function processImageBlob(
	blob: Blob,
): Promise<{ bytes: Blob; mime: string }> {
	const buf = await blob.slice(0, 512).arrayBuffer();
	const preview = new Uint8Array(buf);
	const mime = detectImageType(preview) || blob.type || "application/octet-stream";
	return { bytes: blob, mime };
}
