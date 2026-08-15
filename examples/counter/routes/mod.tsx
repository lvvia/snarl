/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import Counter from "../components/counter.tsx";

export default function Home() {
	return (
		<html>
			<body>
				<Counter initial={5} />
			</body>
		</html>
	);
}
