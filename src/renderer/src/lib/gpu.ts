import { COLORS, MaterialRegistry } from "~/lib/material";
import { Debug } from "./debug";
import { EntityRegistry } from "./entity";
import { GMap, type Tile, TileKinds, VIEWPORT } from "./map";
import shader from "./shaders.wgsl?raw";
import { LightEmitter, type LightSource, Movable, Named } from "./traits";
import { Vec2d } from "./types";

export class GPURenderer {
	private device!: GPUDevice;
	private pipeline!: GPUComputePipeline;
	private initialized = false;

	// Map from color key (kind name or oreName) to color buffer index
	private colorKeyToIndex: Record<string, number> = {};

	// Cache the color buffer to avoid recreating it every frame
	private cachedColorBuffer: GPUBuffer | null = null;
	private colorCacheKey: string = "";
	private cachedDevice: GPUDevice | null = null;
	private needsColorCacheRefresh: boolean = false;

	async init() {
		if (!navigator.gpu) {
			throw new Error("No webGPU");
		}
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("no adapter");

		// Clear cached buffers when device changes
		this.cleanup();

		this.device = await adapter?.requestDevice();
		const module = this.device.createShaderModule({
			code: shader,
		});
		this.pipeline = this.device.createComputePipeline({
			compute: {
				module: module,
				entryPoint: "main",
			},
			layout: "auto",
		});
		this.initialized = true;
	}

	private hexToInt(hex: string | null | undefined): number {
		if (!hex) return 0;
		return parseInt(hex.slice(1), 16);
	}

	private collectLightSources(viewport: Vec2d): LightSource[] {
		const lightEmitters = EntityRegistry.instance.lookup([
			LightEmitter,
			Movable,
			Named,
		]);
		const lights: LightSource[] = [];

		for (const emitter of lightEmitters) {
			const lightSource = emitter.getLightSource();
			const lightX = lightSource.x;
			const lightY = lightSource.y;
			const lightRadius = lightSource.radius;

			const viewportRight = viewport.x + VIEWPORT.x;
			const viewportBottom = viewport.y + VIEWPORT.y;

			if (emitter.inViewportWR()) {
				lights.push(lightSource);
			}
		}

		return lights;
	}

	private createLightBuffer(lights: LightSource[]): GPUBuffer {
		const lightData = new Float32Array(lights.length * 6);

		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			const offset = i * 6;
			lightData[offset] = light.x;
			lightData[offset + 1] = light.y;
			lightData[offset + 2] = light.radius;
			lightData[offset + 4] = light.intensity;
			lightData[offset + 5] = light.neutralPercentage;
		}

		// Create a uint32 view to write colors
		const uint32View = new Uint32Array(lightData.buffer);
		for (let i = 0; i < lights.length; i++) {
			const colorIndex = i * 6 + 3;
			uint32View[colorIndex] = this.hexToInt(lights[i].color);
		}

		const buffer = this.device.createBuffer({
			size: Math.max(lightData.byteLength, 24),
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		if (lights.length > 0) {
			this.device.queue.writeBuffer(buffer, 0, lightData);
		}

		return buffer;
	}

	private createTileBuffer(tiles: Tile[][], viewport: Vec2d): GPUBuffer {
		const data = new Uint32Array(VIEWPORT.x * VIEWPORT.y * 13);

		let i = 0;
		const kindCounts: Record<number, number> = {};

		for (let sy = 0; sy < VIEWPORT.y; sy++) {
			for (let sx = 0; sx < VIEWPORT.x; sx++) {
				const g_x = viewport.x + sx;
				const g_y = viewport.y + sy;
				const tile = tiles[g_x]?.[g_y];

				if (tile) {
					kindCounts[tile.kind] = (kindCounts[tile.kind] || 0) + 1;

					// Determine color index for main tile
					let colorIndex = 0;
					if (
						tile.kind === TileKinds.ore &&
						tile.oreName &&
						this.colorKeyToIndex[tile.oreName] !== undefined
					) {
						colorIndex = this.colorKeyToIndex[tile.oreName];
					} else if (tile.kind === TileKinds.ore && tile.oreName) {
						// Fallback to default ore color if oreName not found
						colorIndex = this.colorKeyToIndex["ore"] ?? 0;
					} else {
						const kindName = TileKinds[tile.kind] as string;
						colorIndex = this.colorKeyToIndex[kindName as string] ?? 0;
						if (colorIndex === 0 && kindName !== "grass") {
						}
					}
					let maskColorIndex = 0;
					if (tile.mask) {
						const maskKindName = TileKinds[tile.mask.kind] as string;
						maskColorIndex = this.colorKeyToIndex[maskKindName as string] ?? 0;
					}

					data[i++] = this.hexToInt(tile.fg);
					data[i++] = this.hexToInt(tile.bg);
					data[i++] = tile.char.charCodeAt(0);
					data[i++] = tile.boundary ? 1 : 0;
					data[i++] = colorIndex; // Use color index instead of kind
					data[i++] = tile.mask ? 1 : 0;
					data[i++] = tile.mask ? this.hexToInt(tile.mask.fg) : 0;
					data[i++] = tile.mask ? this.hexToInt(tile.mask.bg) : 0;
					data[i++] = tile.mask ? tile.mask.char.charCodeAt(0) : 0;
					data[i++] = tile.mask ? maskColorIndex : 0; // Use mask color index
					data[i++] = tile.cursor ? 1 : 0;
					data[i++] = tile.cursor ? this.hexToInt(tile.cursor.fg) : 0;
					data[i++] = tile.cursor ? tile.cursor.char.charCodeAt(0) : 0;
				} else {
					kindCounts[TileKinds.grass] = (kindCounts[TileKinds.grass] || 0) + 1;

					const fallbackIndex = this.colorKeyToIndex["grass"] ?? 0;
					data[i++] = this.hexToInt(
						MaterialRegistry.instance.colors().grass.close,
					);
					data[i++] = 0;
					data[i++] = 46;
					data[i++] = 0;
					data[i++] = fallbackIndex;
					data[i++] = 0;
					data[i++] = 0;
					data[i++] = 0;
					data[i++] = 0;
					data[i++] = 0;
					data[i++] = 0; // has_cursor
					data[i++] = 0; // cursor_fg
					data[i++] = 0; // cursor_char
				}
			}
		}

		const buffer = this.device.createBuffer({
			size: data.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(buffer, 0, data);
		return buffer;
	}

	private createColorBuffer(): GPUBuffer {
		// Create a cache key based on the current colors
		const colors = MaterialRegistry.instance.colors();
		const cacheKey = JSON.stringify(colors);

		// Return cached buffer if colors haven't changed and device hasn't changed
		if (
			this.cachedColorBuffer &&
			this.colorCacheKey === cacheKey &&
			this.cachedDevice === this.device
		) {
			return this.cachedColorBuffer;
		}

		// Colors have changed, create new buffer
		// Destroy old buffer if it exists
		if (this.cachedColorBuffer) {
			this.cachedColorBuffer.destroy();
		}

		// Dynamically build color array from COLORS object
		const colorEntries = Object.entries(colors);
		const colorData = new Uint32Array(colorEntries.length * 3);
		this.colorKeyToIndex = {};
		for (let i = 0; i < colorEntries.length; i++) {
			const key = colorEntries[i][0];
			const colorValues = colorEntries[i][1];
			const index = i * 3;
			colorData[index] = this.hexToInt(colorValues.close);
			colorData[index + 1] = this.hexToInt(colorValues.far);
			colorData[index + 2] = this.hexToInt(colorValues.superFar);
			this.colorKeyToIndex[key] = i;
		}
		const buffer = this.device.createBuffer({
			size: colorData.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.device.queue.writeBuffer(buffer, 0, colorData);

		// Cache the buffer, key, and device
		this.cachedColorBuffer = buffer;
		this.colorCacheKey = cacheKey;
		this.cachedDevice = this.device;

		return buffer;
	}

	// Clean up cached resources
	cleanup() {
		if (this.cachedColorBuffer) {
			this.cachedColorBuffer.destroy();
			this.cachedColorBuffer = null;
			this.colorCacheKey = "";
			this.cachedDevice = null;
		}
	}

	// Invalidate color cache (called when materials are registered)
	invalidateColorCache() {
		console.log("🗑️ Invalidating GPU color cache due to material changes");
		if (this.cachedColorBuffer) {
			this.cachedColorBuffer.destroy();
			this.cachedColorBuffer = null;
			this.colorCacheKey = "";
		}
	}

	private createParamsBuffer(params: {
		playerX: number;
		playerY: number;
		viewportX: number;
		viewportY: number;
		viewRadius: number;
		lightCount: number;
	}): GPUBuffer {
		const STEPS = GMap.DITHER_STEPS;
		const DITHER_RADIUS = GMap.DITHER_RADIUS;
		const SUPER_FAR_RADIUS = GMap.SUPER_FAR_RADIUS;

		const paramsData = new ArrayBuffer(44);
		const view = new DataView(paramsData);

		view.setFloat32(0, params.playerX, true);
		view.setFloat32(4, params.playerY, true);
		view.setInt32(8, params.viewportX, true);
		view.setInt32(12, params.viewportY, true);
		view.setUint32(16, VIEWPORT.x, true);
		view.setUint32(20, VIEWPORT.y, true);
		view.setFloat32(24, params.viewRadius, true);
		view.setFloat32(28, DITHER_RADIUS, true);
		view.setFloat32(32, SUPER_FAR_RADIUS, true);
		view.setUint32(36, STEPS, true);
		view.setUint32(40, params.lightCount, true);

		const buffer = this.device.createBuffer({
			size: paramsData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.device.queue.writeBuffer(buffer, 0, new Uint8Array(paramsData));
		return buffer;
	}

	async render(
		tiles: Tile[][],
		playerPos: { x: number; y: number },
		viewport: { x: number; y: number },
		viewRadius: number,
	): Promise<
		{ char: string; fg: string; bg: string | null; x: number; y: number }[]
	> {
		if (!this.initialized) {
			await this.init();
		}

		const viewportVec2d = Vec2d(viewport);

		const lights = this.collectLightSources(viewportVec2d);

		// Create color buffer FIRST to populate colorKeyToIndex mapping
		const colorBuffer = this.createColorBuffer();

		// Now create tile buffer with proper colorKeyToIndex populated
		const tileBuffer = this.createTileBuffer(tiles, viewportVec2d);
		const lightBuffer = this.createLightBuffer(lights);
		const paramsBuffer = this.createParamsBuffer({
			playerX: playerPos.x,
			playerY: playerPos.y,
			viewportX: viewport.x,
			viewportY: viewport.y,
			viewRadius,
			lightCount: lights.length,
		});

		const outputSize = VIEWPORT.x * VIEWPORT.y * 3 * 4;
		const outputBuffer = this.device.createBuffer({
			size: outputSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
		});

		const stagingBuffer = this.device.createBuffer({
			size: outputSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});

		const bindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: tileBuffer } },
				{ binding: 1, resource: { buffer: colorBuffer } },
				{ binding: 2, resource: { buffer: paramsBuffer } },
				{ binding: 3, resource: { buffer: outputBuffer } },
				{ binding: 4, resource: { buffer: lightBuffer } },
			],
		});

		const commandEncoder = this.device.createCommandEncoder();
		const passEncoder = commandEncoder.beginComputePass();

		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, bindGroup);
		passEncoder.dispatchWorkgroups(
			Math.ceil(VIEWPORT.x / 8),
			Math.ceil(VIEWPORT.y / 8),
		);
		passEncoder.end();

		commandEncoder.copyBufferToBuffer(
			outputBuffer,
			0,
			stagingBuffer,
			0,
			outputSize,
		);
		this.device.queue.submit([commandEncoder.finish()]);

		await stagingBuffer.mapAsync(GPUMapMode.READ);
		const arrayBuffer = stagingBuffer.getMappedRange();
		const results = new Uint32Array(arrayBuffer);

		const pixels: {
			char: string;
			fg: string;
			bg: string | null;
			x: number;
			y: number;
		}[] = [];

		for (let i = 0; i < VIEWPORT.x * VIEWPORT.y; i++) {
			const charCode = results[i * 3];
			const char = charCode === 0 ? " " : String.fromCharCode(charCode);
			const fgInt = results[i * 3 + 1];
			const fg =
				fgInt === 0 ? "#000000" : `#${fgInt.toString(16).padStart(6, "0")}`;
			const bgInt = results[i * 3 + 2];
			const bg = bgInt === 0 ? null : `#${bgInt.toString(16).padStart(6, "0")}`;
			const x = i % VIEWPORT.x;
			const y = Math.floor(i / VIEWPORT.x);

			pixels.push({ char, fg, bg, x, y });
		}

		stagingBuffer.unmap();

		tileBuffer.destroy();
		// Don't destroy colorBuffer - it's cached for reuse
		lightBuffer.destroy();
		paramsBuffer.destroy();
		outputBuffer.destroy();
		stagingBuffer.destroy();

		return pixels;
	}
}
