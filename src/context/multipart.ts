/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { HttpError } from "../errors.ts";

/** represents a file uploaded via `multipart/form-data` */
export interface UploadedFile {
	/** the field name in the form */
	name: string;
	/** the filename provided by the client */
	filename: string;
	/** the MIME type provided by the client */
	type: string;
	/** the size of the file in bytes */
	size: number;
	/** the raw file content */
	content: Uint8Array;
}

export interface MultipartOptions {
	/**
	 * reject any single file whose declared size exceeds this, in bytes.
	 * unlimited by default
	 */
	maxFileSize?: number;
	/**
	 * reject the whole request if the sum of all file sizes exceeds this,
	 * in bytes. unlimited by default
	 */
	maxTotalSize?: number;
}

export interface MultipartResult {
	fields: Record<string, string>;
	files: Record<string, UploadedFile>;
}

/**
 * parses a request as `multipart/form-data`
 * @example
 * ```ts
 * app.post("/upload", async (ctx) => {
 *   const { files } = await ctx.multipart({ maxFileSize: 10 * 1024 * 1024 });
 *   console.log(`Received ${files.avatar.filename}`);
 * });
 * ```
 */
export async function createMultipartReader(
	request: Request,
	options: MultipartOptions = {},
): Promise<MultipartResult> {
	const declaredLength = Number(request.headers.get("Content-Length"));
	if (options.maxTotalSize && Number.isFinite(declaredLength) && declaredLength > options.maxTotalSize) {
		throw new HttpError(413, "Payload Too Large");
	}

	const formData = await request.formData();
	const fields: Record<string, string> = {};
	const files: Record<string, UploadedFile> = {};
	let total = 0;

	for (const [name, value] of formData.entries()) {
		if (value instanceof File) {
			if (options.maxFileSize && value.size > options.maxFileSize) {
				throw new HttpError(413, `File "${value.name}" exceeds the ${options.maxFileSize}-byte limit`);
			}

			total += value.size;
			if (options.maxTotalSize && total > options.maxTotalSize) {
				throw new HttpError(413, "Payload Too Large");
			}

			files[name] = {
				name,
				filename: value.name,
				type: value.type,
				size: value.size,
				content: new Uint8Array(await value.arrayBuffer()),
			};
		} else {
			fields[name] = value;
		}
	}

	return { fields, files };
}
