/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

export interface LogSink {
	info(namespace: string, ...args: unknown[]): void;
	warn(namespace: string, ...args: unknown[]): void;
	error(namespace: string, ...args: unknown[]): void;
	success(namespace: string, ...args: unknown[]): void;
	raw(...args: unknown[]): void;
}

const consoleSink: LogSink = {
	info: (_, ...args) => console.info(...args),
	warn: (_, ...args) => console.warn(...args),
	error: (_, ...args) => console.error(...args),
	success: (_, ...args) => console.log(...args),
	raw: console.log,
};

const noopSink: LogSink = { info() {}, warn() {}, error() {}, raw() {}, success() {} };

let sink: LogSink = consoleSink;

export function setLogSink(next: LogSink | false | null | undefined): void {
	sink = !next ? noopSink : next;
}

export const log: LogSink = {
	info: (...a) => sink.info(...a),
	warn: (...a) => sink.warn(...a),
	error: (...a) => sink.error(...a),
	success: (...a) => sink.success(...a),
	raw: (...a) => sink.raw(...a),
};
