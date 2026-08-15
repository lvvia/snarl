/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { assertEquals } from "@std/assert";
import { canPossiblyMatch, createNode, getSegments, insertRoute, matchRoute, type RadixNode } from "@july/snarl";

function match(root: RadixNode<string>, path: string, opts: Parameters<typeof matchRoute>[4] = {}) {
	const segments = path === "/" ? [] : getSegments(path, opts.trailingSlashSensitive ?? false);
	const params: Record<string, string> = {};
	const result = matchRoute(root, segments, 0, params, opts);
	return result ? { payload: result.payload, params } : null;
}

Deno.test("getSegments", async (t) => {
	await t.step("splits on '/', ignoring the leading empty segment", () => {
		assertEquals(getSegments("/a/b/c", false), ["a", "b", "c"]);
	});
	await t.step("root path yields no segments", () => {
		assertEquals(getSegments("/", false), []);
	});
	await t.step("trailingSlashSensitive: trailing slash on non-root yields a trailing empty segment", () => {
		assertEquals(getSegments("/a/", true), ["a", ""]);
	});
	await t.step("not trailingSlashSensitive: trailing slash produces no extra segment", () => {
		assertEquals(getSegments("/a/", false), ["a"]);
	});
});

Deno.test("insertRoute + matchRoute: static segments", async (t) => {
	await t.step("matches an exact static path", () => {
		const root = createNode("");
		insertRoute(root, "/users", "users-handler");
		assertEquals(match(root, "/users")?.payload, "users-handler");
	});
	await t.step("does not match a differing static path", () => {
		const root = createNode("");
		insertRoute(root, "/users", "users-handler");
		assertEquals(match(root, "/posts"), null);
	});
	await t.step("case-sensitive by default", () => {
		const root = createNode("");
		insertRoute(root, "/Users", "h");
		assertEquals(match(root, "/users"), null);
		assertEquals(match(root, "/Users")?.payload, "h");
	});
	await t.step("caseSensitive: false normalises both insert and match", () => {
		const root = createNode("");
		insertRoute(root, "/Users", "h", { caseSensitive: false });
		assertEquals(match(root, "/users", { caseSensitive: false })?.payload, "h");
	});
});

Deno.test("insertRoute + matchRoute: params", async (t) => {
	await t.step("extracts a single named param", () => {
		const root = createNode("");
		insertRoute(root, "/users/:id", "h");
		const r = match(root, "/users/42");
		assertEquals(r?.payload, "h");
		assertEquals(r?.params.id, "42");
	});
	await t.step("extracts multiple params across segments", () => {
		const root = createNode("");
		insertRoute(root, "/a/:x/b/:y", "h");
		const r = match(root, "/a/1/b/2");
		assertEquals(r?.params, { x: "1", y: "2" });
	});
	await t.step("decodes percent-encoded param values", () => {
		const root = createNode("");
		insertRoute(root, "/q/:term", "h");
		const r = match(root, "/q/a%20b");
		assertEquals(r?.params.term, "a b");
	});
	await t.step("malformed percent-encoding falls back to the raw segment", () => {
		const root = createNode("");
		insertRoute(root, "/q/:term", "h");
		const r = match(root, "/q/%ZZ");
		assertEquals(r?.params.term, "%ZZ");
	});
	await t.step("static segment wins over a param at the same position", () => {
		const root = createNode("");
		insertRoute(root, "/users/new", "static");
		insertRoute(root, "/users/:id", "param");
		assertEquals(match(root, "/users/new")?.payload, "static");
		assertEquals(match(root, "/users/123")?.payload, "param");
		assertEquals(match(root, "/users/123")?.params.id, "123");
	});
	await t.step("insertion order does not affect static-over-param precedence", () => {
		const root = createNode("");
		insertRoute(root, "/users/:id", "param");
		insertRoute(root, "/users/admin", "static");
		assertEquals(match(root, "/users/admin")?.payload, "static");
	});
});

Deno.test("insertRoute + matchRoute: optional params", async (t) => {
	await t.step("matches when the optional param is present", () => {
		const root = createNode("");
		insertRoute(root, "/posts/:id?", "h");
		assertEquals(match(root, "/posts/1")?.params.id, "1");
	});
	await t.step("matches when the optional param is absent", () => {
		const root = createNode("");
		insertRoute(root, "/posts/:id?", "h");
		const r = match(root, "/posts");
		assertEquals(r?.payload, "h");
		assertEquals(r?.params.id, undefined);
	});
	await t.step("optional param in the middle of a path, both present and absent", () => {
		const root = createNode("");
		insertRoute(root, "/users/:id?/posts", "h");
		assertEquals(match(root, "/users/42/posts")?.params.id, "42");
		assertEquals(match(root, "/users/posts")?.params.id, undefined);
	});
	await t.step("multiple optional params resolve independently", () => {
		const root = createNode("");
		insertRoute(root, "/a/:b?/:c?", "h");
		assertEquals(match(root, "/a/x/y")?.params, { b: "x", c: "y" });
		assertEquals(match(root, "/a/x")?.params, { b: "x" });
		assertEquals(match(root, "/a")?.params, {});
	});
});

Deno.test("insertRoute + matchRoute: wildcards", async (t) => {
	await t.step("captures the remaining path under '*'", () => {
		const root = createNode("");
		insertRoute(root, "/files/*", "h");
		const r = match(root, "/files/a/b/c.txt");
		assertEquals(r?.params["*"], "a/b/c.txt");
	});
	await t.step("named wildcard captures under the given name", () => {
		const root = createNode("");
		insertRoute(root, "/assets/*path", "h");
		assertEquals(match(root, "/assets/img/x.png")?.params.path, "img/x.png");
	});
	await t.step("root-level wildcard matches any path", () => {
		const root = createNode("");
		insertRoute(root, "/*", "h");
		assertEquals(match(root, "/anything/at/all")?.params["*"], "anything/at/all");
	});
	await t.step("param beats wildcard at the same position", () => {
		const root = createNode("");
		insertRoute(root, "/api/:resource", "param");
		insertRoute(root, "/api/*", "wildcard");
		assertEquals(match(root, "/api/users")?.payload, "param");
	});
	await t.step("wildcard still matches when no param is registered", () => {
		const root = createNode("");
		insertRoute(root, "/api/*", "wildcard");
		assertEquals(match(root, "/api/users")?.payload, "wildcard");
	});
});

Deno.test("matchRoute: specificity between static-prefixed patterns", () => {
	const root = createNode("");
	insertRoute(root, "/a/:b", "short");
	insertRoute(root, "/a/:b/c", "long");
	assertEquals(match(root, "/a/x")?.payload, "short");
	assertEquals(match(root, "/a/x/c")?.payload, "long");
});

Deno.test("matchRoute: no match returns null, not throw", () => {
	const root = createNode("");
	insertRoute(root, "/known", "h");
	assertEquals(match(root, "/unknown"), null);
});

Deno.test("canPossiblyMatch", async (t) => {
	await t.step("true when a static child matches the first segment", () => {
		const root = createNode("");
		insertRoute(root, "/users", "h");
		assertEquals(canPossiblyMatch(root, "users", true), true);
	});
	await t.step("false when no static child and no param/wildcard child exist", () => {
		const root = createNode("");
		insertRoute(root, "/users", "h");
		assertEquals(canPossiblyMatch(root, "posts", true), false);
	});
	await t.step("true whenever a param child exists, regardless of the first segment", () => {
		const root = createNode("");
		insertRoute(root, "/:id", "h");
		assertEquals(canPossiblyMatch(root, "anything", true), true);
	});
	await t.step("true whenever a wildcard child exists", () => {
		const root = createNode("");
		insertRoute(root, "/*", "h");
		assertEquals(canPossiblyMatch(root, "anything", true), true);
	});
	await t.step("respects case sensitivity for static-child lookup", () => {
		const root = createNode("");
		insertRoute(root, "/Users", "h", { caseSensitive: false });
		assertEquals(canPossiblyMatch(root, "users", false), true);
		assertEquals(canPossiblyMatch(root, "users", true), false);
	});
});
