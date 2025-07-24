import tailwindcss from "@tailwindcss/vite";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { copyFileSync, existsSync } from "fs";
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
		plugins: [
			solid(),
			tailwindcss(),
			{
				name: "copy-worker",
				writeBundle() {
					// Copy worker.js to the build output
					const workerSrc = resolve("src/renderer/public/worker.js");
					const workerDest = resolve("out/renderer/worker.js");
					if (existsSync(workerSrc)) {
						copyFileSync(workerSrc, workerDest);
						console.log("Copied worker.js to build output");
					}
					
					// Copy font file to the build output
					const fontSrc = resolve("src/renderer/public/MorePerfectDOSVGA.ttf");
					const fontDest = resolve("out/renderer/MorePerfectDOSVGA.ttf");
					if (existsSync(fontSrc)) {
						copyFileSync(fontSrc, fontDest);
						console.log("Copied MorePerfectDOSVGA.ttf to build output");
					}
				},
			},
		],
	},
});
