import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	vite: {
		plugins: [
			tailwindcss(),
			VitePWA({
				registerType: "autoUpdate",
				injectRegister: "auto",
				workbox: {
					maximumFileSizeToCacheInBytes: 10000000,
				},
				manifest: {
					name: "Iro",
					short_name: "Iro",
					description: "Factory",
					theme_color: "#000000",
					background_color: "#000000",
					display: "standalone",
					icons: [
						{
							src: "/favicon.ico",
							sizes: "16x16",
							type: "image/x-icon",
						},
					],
				},
				devOptions: {
					enabled: process.env.SW_DEV === "true",
					type: "module",
					navigateFallback: "index.html",
				},
			}),
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
