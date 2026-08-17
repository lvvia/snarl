/**
 * snarl, a minimal web framework for deno
 * Copyright (c) 2025-2026 kyu.re
 * SPDX-License-Identifier: MPL-2.0
 */

import Todos from "../components/todo.tsx";

export default function Page() {
	return (
		<html>
			<body>
				<Todos />
			</body>
		</html>
	);
}
