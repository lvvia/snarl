/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { assertEquals } from "@std/assert";
import {
	BadRequestError,
	ConflictError,
	ForbiddenError,
	HttpError,
	InternalServerError,
	MethodNotAllowedError,
	NotFoundError,
	TooManyRequestsError,
	UnauthorizedError,
	UnprocessableEntityError,
} from "@july/snarl";

Deno.test("HttpError: base class carries status, message, headers", () => {
	const err = new HttpError(418, "teapot", { "X-Extra": "yes" });
	assertEquals(err.status, 418);
	assertEquals(err.message, "teapot");
	assertEquals(err.name, "HttpError");
	assertEquals(err.headers, { "X-Extra": "yes" });
	assertEquals(err instanceof Error, true);
});

Deno.test("HttpError: headers default to undefined when omitted", () => {
	const err = new HttpError(500, "oops");
	assertEquals(err.headers, undefined);
});

const subclasses: [new (message?: string) => HttpError, number, string][] = [
	[BadRequestError, 400, "Bad Request"],
	[UnauthorizedError, 401, "Unauthorized"],
	[ForbiddenError, 403, "Forbidden"],
	[NotFoundError, 404, "Not Found"],
	[MethodNotAllowedError, 405, "Method Not Allowed"],
	[ConflictError, 409, "Conflict"],
	[UnprocessableEntityError, 422, "Unprocessable Entity"],
	[InternalServerError, 500, "Internal Server Error"],
];

for (const [Ctor, status, defaultMessage] of subclasses) {
	Deno.test(`${Ctor.name}: default message and status`, () => {
		const err = new Ctor();
		assertEquals(err.status, status);
		assertEquals(err.message, defaultMessage);
		assertEquals(err instanceof HttpError, true);
	});

	Deno.test(`${Ctor.name}: custom message overrides default`, () => {
		const err = new Ctor("custom");
		assertEquals(err.message, "custom");
		assertEquals(err.status, status);
	});
}

Deno.test("TooManyRequestsError: default message and status", () => {
	const err = new TooManyRequestsError();
	assertEquals(err.status, 429);
	assertEquals(err.message, "Too Many Requests");
	assertEquals(err.headers, undefined);
});

Deno.test("TooManyRequestsError: retryAfter sets Retry-After header", () => {
	const err = new TooManyRequestsError("slow down", "30");
	assertEquals(err.message, "slow down");
	assertEquals(err.headers, { "Retry-After": "30" });
});

Deno.test("TooManyRequestsError: no retryAfter leaves headers undefined", () => {
	const err = new TooManyRequestsError("slow down");
	assertEquals(err.headers, undefined);
});
