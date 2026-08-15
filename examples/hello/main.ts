/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import { createApp } from "@404/imouto";
import { aether } from "@404/aether";

const app = await createApp({ routesDir: "./routes" });

app.use(aether({ entrypoints: ["./routes"] }));

app.serve({ port: 8000 });
