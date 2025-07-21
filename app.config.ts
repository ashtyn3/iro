import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	vite: {
		plugins: [
			tailwindcss(),
			// VitePWA({
			// 	registerType: "autoUpdate",
			// 	injectRegister: "inline",
			// 	workbox: {
			// 		maximumFileSizeToCacheInBytes: 10000000,
			// 		globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
			// 	},
			// 	manifest: {
			// 		name: "Iro",
			// 		short_name: "Iro",
			// 		description: "Factory",
			// 		theme_color: "#000000",
			// 	},
			// }),
		],
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
