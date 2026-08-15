# [`@404/imouto`]

a minimal full-stack web framework built on [snarl](https://jsr.io/@july/snarl)

## features

- file-based routing. supports dynamic params (`[id].tsx` → `/blog/:id`), catch-all routes
  (`[...slug].tsx`), and nested directories
- `_middleware.ts` applies middleware to all routes in a directory, `_error.tsx` provides error
  boundaries, `_404.tsx` handles missing routes
- `<Head>` component collects `<title>`, `<meta>`, `<link>`, and `<script>` tags

## quick start

```ts
// ./main.ts
import { createApp } from "@404/imouto";

const app = await createApp({ routesDir: "./routes" });
app.serve({ port: 8000 });
```

```ts
routes/
├── mod.tsx              GET /
├── about.tsx            GET /about
├── blog/
│   ├── mod.tsx          GET /blog
│   ├── [id].tsx         GET /blog/:id
│   ├── _layout.tsx      wraps all /blog/* routes
│   └── _middleware.ts   auth check for /blog/*
├── _layout.tsx          root layout
├── _error.tsx           error boundary
└── _404.tsx             404 page
```

[`@404/imouto`]: https://kyu.re/~snarl
[snarl]: https://jsr.io/@july/snarl
