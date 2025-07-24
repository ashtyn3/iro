import tailwindcss from "@tailwindcss/vite";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";
import solid from "vite-plugin-solid";

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin(), tailwindcss()],
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		build: {
			rollupOptions: {
				external: [],
			},
		},
	},
	renderer: {
		resolve: {
			alias: {
				"@renderer": resolve("src/renderer/src"),
				"~": resolve("src/renderer/src"),
			},
		},
		plugins: [solid(), tailwindcss()],
	},
});
