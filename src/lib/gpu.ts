import { Debug } from "./debug";
import { EntityRegistry } from "./entity";
import { COLORS, type Tile, TileKinds, VIEWPORT } from "./map";
import shader from "./shaders.wgsl?raw";
import { Vec2d } from "./state";
import { LightEmitter, type LightSource, Movable, Named } from "./traits";

export class GPURenderer {
	private device!: GPUDevice;
	private pipeline!: GPUComputePipeline;
	private initialized = false;

	async init() {
		if (!navigator.gpu) {
			throw new Error("No webGPU");
		}
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("no adapter");

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
			// Only include lights that might affect the viewport
			const lightX = lightSource.x;
			const lightY = lightSource.y;
			const lightRadius = lightSource.radius;

			const viewportRight = viewport.x + VIEWPORT.x;
			const viewportBottom = viewport.y + VIEWPORT.y;

			// Check if light could affect viewport area (including radius)
			if (emitter.inViewportWR()) {
				lights.push(lightSource);
			}
			// if (
			// 	lightX + lightRadius >= viewport.x &&
			// 	lightX - lightRadius <= viewportRight &&
			// 	lightY + lightRadius >= viewport.y &&
			// 	lightY - lightRadius <= viewportBottom
			// ) {
			// 	lights.push(lightSource);
			// } else {
			// 	Debug.getInstance().info(emitter.name, "not in viewport");
			// }
		}

		return lights;
	}

	private createLightBuffer(lights: LightSource[]): GPUBuffer {
		// Each light source: x, y, radius, color, intensity (5 floats, but color is u32)
		const lightData = new Float32Array(lights.length * 5);

		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			const offset = i * 5;
			lightData[offset] = light.x;
			lightData[offset + 1] = light.y;
			lightData[offset + 2] = light.radius;
			// Color needs to be stored as u32 but we'll use a view to write it
			lightData[offset + 4] = light.intensity;
		}

		// Create a uint32 view to write colors
		const colorView = new Uint32Array(lightData.buffer);
		for (let i = 0; i < lights.length; i++) {
			const colorIndex = i * 5 + 3; // 3rd element in each light (after x, y, radius)
			colorView[colorIndex] = this.hexToInt(lights[i].color);
		}

		const buffer = this.device.createBuffer({
			size: Math.max(lightData.byteLength, 20), // Minimum size for WebGPU binding
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		if (lights.length > 0) {
			this.device.queue.writeBuffer(buffer, 0, lightData);
		}

		return buffer;
	}

	private createTileBuffer(tiles: Tile[][], viewport: Vec2d): GPUBuffer {
		const data = new Uint32Array(VIEWPORT.x * VIEWPORT.y * 10);

		let i = 0;
		const kindCounts: Record<number, number> = {}; // Debug

		// Fixed: Correct loop order - sy first, then sx
		for (let sy = 0; sy < VIEWPORT.y; sy++) {
			for (let sx = 0; sx < VIEWPORT.x; sx++) {
				const g_x = viewport.x + sx;
				const g_y = viewport.y + sy;
				const tile = tiles[g_x]?.[g_y];

				if (tile) {
					// Debug: count tile kinds
					kindCounts[tile.kind] = (kindCounts[tile.kind] || 0) + 1;

					data[i++] = this.hexToInt(tile.fg);
					data[i++] = this.hexToInt(tile.bg);
					data[i++] = tile.char.charCodeAt(0);
					data[i++] = tile.boundary ? 1 : 0;
					data[i++] = tile.kind;
					data[i++] = tile.mask ? 1 : 0;
					data[i++] = tile.mask ? this.hexToInt(tile.mask.fg) : 0;
					data[i++] = tile.mask ? this.hexToInt(tile.mask.bg) : 0;
					data[i++] = tile.mask ? tile.mask.char.charCodeAt(0) : 0;
					data[i++] = tile.mask ? tile.mask.kind : 0;
				} else {
					// Missing tile - fill with grass defaults
					kindCounts[TileKinds.grass] = (kindCounts[TileKinds.grass] || 0) + 1;

					data[i++] = this.hexToInt(COLORS.grass.close); // fg
					data[i++] = 0; // bg
					data[i++] = 46; // char '.'
					data[i++] = 0; // boundary
					data[i++] = TileKinds.grass; // kind
					data[i++] = 0; // has_mask
					data[i++] = 0; // mask_fg
					data[i++] = 0; // mask_bg
					data[i++] = 0; // mask_char
					data[i++] = 0; // mask_kind
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
		// Create array with exactly 8 entries (one for each TileKind)
		const colorData = new Uint32Array(8 * 3);

		// Map enum values to colors
		const colorArray = [
			COLORS.grass, // TileKinds.grass = 0
			COLORS.water, // TileKinds.water = 1
			COLORS.rock, // TileKinds.rock = 2
			COLORS.copper, // TileKinds.copper = 3
			COLORS.wood, // TileKinds.wood = 4
			COLORS.leafs, // TileKinds.leafs = 5
			COLORS.struct, // TileKinds.struct = 6
			COLORS.tree, // TileKinds.tree = 7
		];

		for (let kind = 0; kind < 8; kind++) {
			const colors = colorArray[kind];
			const index = kind * 3;
			colorData[index] = this.hexToInt(colors.close);
			colorData[index + 1] = this.hexToInt(colors.far);
			colorData[index + 2] = this.hexToInt(colors.superFar);
		}

		const buffer = this.device.createBuffer({
			size: colorData.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.device.queue.writeBuffer(buffer, 0, colorData);
		return buffer;
	}

	private createParamsBuffer(params: {
		playerX: number;
		playerY: number;
		viewportX: number;
		viewportY: number;
		viewRadius: number;
		lightCount: number;
	}): GPUBuffer {
		const STEPS = 5;
		const DITHER_RADIUS = 10;
		const SUPER_FAR_RADIUS = 20;

		const paramsData = new ArrayBuffer(44); // Increased size for light_count
		const view = new DataView(paramsData);

		view.setFloat32(0, params.playerX, true);
		view.setFloat32(4, params.playerY, true);
		view.setInt32(8, params.viewportX, true);
		view.setInt32(12, params.viewportY, true);
		view.setUint32(16, VIEWPORT.x, true); // viewport_width
		view.setUint32(20, VIEWPORT.y, true); // viewport_height
		view.setFloat32(24, params.viewRadius, true);
		view.setFloat32(28, DITHER_RADIUS, true);
		view.setFloat32(32, SUPER_FAR_RADIUS, true);
		view.setUint32(36, STEPS, true);
		view.setUint32(40, params.lightCount, true); // light_count

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

		// Convert viewport to Vec2d format
		const viewportVec2d = Vec2d(viewport);

		// Collect light sources
		const lights = this.collectLightSources(viewportVec2d);

		// Create buffers
		const tileBuffer = this.createTileBuffer(tiles, viewportVec2d);
		const colorBuffer = this.createColorBuffer();
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
		colorBuffer.destroy();
		lightBuffer.destroy();
		paramsBuffer.destroy();
		outputBuffer.destroy();
		stagingBuffer.destroy();

		return pixels;
	}
}
