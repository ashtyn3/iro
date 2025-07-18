import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
	},
	server: {
		esbuild: {
			options: {
				supported: {
					"top-level-await": true,
				},
				keepNames: true,
			},
		},
	},
});
