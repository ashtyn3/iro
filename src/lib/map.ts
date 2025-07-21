import type { ConvexClient } from "convex/browser";
import { Set as ImmutableSet } from "immutable";
import seedrandom from "seedrandom";
import { createNoise2D } from "simplex-noise";
import { createSignal, from } from "solid-js";
import { api } from "~/convex/_generated/api";
import { MaterialRegistry } from "~/lib/material";
import { EntityRegistry } from "./entity";
import {
	generateMaterialInventory,
	type Material,
	makeMaterial,
} from "./generators/material_gen";
import { GPURenderer } from "./gpu";
import type { Engine } from "./index";
import { DB, Vec2d } from "./state";
import { LightEmitter, type LightSource, Movable } from "./traits";

const COLORS = () => MaterialRegistry.instance.colors();

export enum TileKinds {
	grass,
	water,
	rock,
	copper,
	wood,
	leafs,
	struct,
	tree,
	berry,
	cursor,
	ore,
}

export const VIEWPORT: Vec2d = Vec2d({ x: 80, y: 40 });
export const CELL_SIZE = 80;
export const CELL_AREA_KM2 = (CELL_SIZE / 1000) ** 2;

export type Cluster = {
	kind: TileKinds;
	points: Vec2d[];
	center: { x: number; y: number };
};

export type Clusters = {
	[key in Exclude<TileKinds, TileKinds.cursor>]: Cluster[];
};

export interface promotion {
	type: string;
	[key: string]: any;
}
export interface Tile {
	fg?: string;
	bg?: string;
	char: string;
	boundary: boolean;
	kind: TileKinds;
	mask: {
		fg: string;
		bg: string;
		char: string;
		kind: TileKinds;
		promotable: promotion;
	} | null;
	promotable?: promotion;
	oreName?: string; // For dynamic ore color lookup
}

export class GMap {
	public static readonly VIEW_RADIUS_BASE = 10;
	public static readonly DITHER_RADIUS = 10;
	public static readonly SUPER_FAR_RADIUS = 20;
	public static readonly DITHER_STEPS = 5;

	width: number;
	height: number;
	map: number[][];
	engine: Engine;
	tiles: Tile[][];
	computedClusters: Clusters;
	gpu: GPURenderer;
	useGPU: boolean;
	mapId: string;
	convex: ConvexClient;
	saved: boolean;
	writeQueue: { x: number; y: number; tile: Tile }[];
	clusterQueue: { operation: "remove"; cluster: Cluster }[] = [];
	materials: Material[];
	mapAreaKm2: number;
	private queueFlushTimer: number | null = null;
	private _isFlushingQueue = createSignal(false);
	public get isFlushingQueue() {
		return this._isFlushingQueue[0]();
	}
	private setIsFlushingQueue = this._isFlushingQueue[1];

	constructor(
		w: number,
		h: number,
		e: Engine,
		convex: ConvexClient,
		id: string,
	) {
		this.mapId = id;
		this.gpu = new GPURenderer();
		this.useGPU = false;
		this.width = w;
		this.height = h;
		this.engine = e;
		this.tiles = [];
		this.convex = convex;
		this.computedClusters = {
			[TileKinds.grass]: [],
			[TileKinds.water]: [],
			[TileKinds.rock]: [],
			[TileKinds.copper]: [],
			[TileKinds.wood]: [],
			[TileKinds.leafs]: [],
			[TileKinds.struct]: [],
			[TileKinds.tree]: [],
			[TileKinds.berry]: [],
			[TileKinds.ore]: [],
		};
		this.map = [];
		this.saved = false;
		this.writeQueue = [];
		this.clusterQueue = [];
		this.materials = [];
		this.mapAreaKm2 = w * h * CELL_AREA_KM2;
	}

	getViewport(): { x: number; y: number; width: number; height: number } {
		const vp = this.engine.viewport();
		return {
			x: vp.x,
			y: vp.y,
			width: VIEWPORT.x,
			height: VIEWPORT.y,
		};
	}

	async updateViewportTile(
		viewportX: number,
		viewportY: number,
		newTile: Tile,
	): Promise<void> {
		const viewport = this.getViewport();
		const worldX = viewport.x + viewportX;
		const worldY = viewport.y + viewportY;

		if (worldX >= this.width || worldY >= this.height) {
			throw new Error("Tile position outside world bounds");
		}

		this.tiles[worldX][worldY] = newTile;

		if (this.mapId) {
			this.writeQueue.push({ x: viewportX, y: viewportY, tile: newTile });

			if (this.writeQueue.length >= 1000) {
				this.engine.debug.info("Write queue full, flushing early");
				await this.flushWriteQueue();
			}

			// For saved maps, also trigger more frequent flushes to keep updates current
			if (this.saved && this.writeQueue.length >= 50) {
				this.engine.debug.info(
					"Saved map: flushing queue to keep updates current",
				);
				await this.flushWriteQueue();
			}

			// Schedule automatic flush if not already scheduled
			this.scheduleAutoFlush();
		}
	}

	async flushWriteQueue() {
		// Prevent concurrent flush operations
		if (this.isFlushingQueue) {
			this.engine.debug.info("Queue flush already in progress, skipping");
			return;
		}

		this.engine.debug.info(
			`flushing write queue ${this.writeQueue.length} tiles, ${this.clusterQueue.length} cluster ops`,
		);
		if (this.writeQueue.length === 0 && this.clusterQueue.length === 0) {
			return;
		}

		this.setIsFlushingQueue(true);

		try {
			const db = new DB(this.convex);
			const BATCH_SIZE = 200; // Smaller batches for more reliable processing
			const queueToProcess = [...this.writeQueue]; // Create a copy to process
			const clusterOpsToProcess = [...this.clusterQueue]; // Copy cluster operations
			this.writeQueue = []; // Clear the queue immediately to accept new updates
			this.clusterQueue = []; // Clear cluster queue
			const failedUpdates: Array<{ x: number; y: number; tile: Tile }> = [];
			const failedClusterOps: { operation: "remove"; cluster: Cluster }[] = [];

			this.engine.debug.info(
				`Processing ${queueToProcess.length} queued updates in batches of ${BATCH_SIZE}`,
			);

			// Process updates in batches
			for (let i = 0; i < queueToProcess.length; i += BATCH_SIZE) {
				const batch = queueToProcess.slice(i, i + BATCH_SIZE);
				const batchNum = Math.floor(i / BATCH_SIZE) + 1;

				try {
					await db.updateViewportTiles(this.mapId, this.getViewport(), batch);
					this.engine.debug.info(
						`Successfully flushed batch ${batchNum}/${Math.ceil(queueToProcess.length / BATCH_SIZE)}`,
					);
				} catch (error) {
					this.engine.debug.error(
						`Failed to flush batch ${batchNum}: ${error}`,
					);
					// Keep track of failed updates to retry later
					failedUpdates.push(...batch);
				}
			}

			// Process cluster operations
			for (const clusterOp of clusterOpsToProcess) {
				try {
					if (clusterOp.operation === "remove") {
						await this.processClusterRemoval(clusterOp.cluster);
						this.engine.debug.info(`Successfully processed cluster removal`);
					}
				} catch (error) {
					this.engine.debug.error(
						`Failed to process cluster operation: ${error}`,
					);
					failedClusterOps.push(clusterOp);
				}
			}

			// Re-add failed updates to the front of the queue for priority retry
			if (failedUpdates.length > 0) {
				this.writeQueue = [...failedUpdates, ...this.writeQueue];
				this.engine.debug.warn(
					`${failedUpdates.length} updates failed and added back to queue for retry`,
				);
			}

			if (failedClusterOps.length > 0) {
				this.clusterQueue = [...failedClusterOps, ...this.clusterQueue];
				this.engine.debug.warn(
					`${failedClusterOps.length} cluster operations failed and added back to queue for retry`,
				);
			}
		} finally {
			this.setIsFlushingQueue(false);
		}
	}

	private scheduleAutoFlush() {
		// Clear existing timer if any
		if (this.queueFlushTimer !== null) {
			clearTimeout(this.queueFlushTimer);
		}

		// Schedule automatic flush after 2 seconds of inactivity
		this.queueFlushTimer = window.setTimeout(() => {
			if (this.writeQueue.length > 0) {
				this.engine.debug.info("Auto-flushing queue after timeout");
				this.flushWriteQueue();
			}
			this.queueFlushTimer = null;
		}, 2000);
	}
	async genMap(): Promise<{ state: boolean; message: string }> {
		const canMakeMap = await this.convex.query(
			api.functions.saveTileSet.canMakeMap,
			{},
		);
		if (!canMakeMap.state) {
			return { state: false, message: canMakeMap.message };
		}
		// Only generate ore materials for now
		this.materials = [];
		for (let i = 0; i < 10; i++) {
			this.materials.push(makeMaterial(`${this.mapId}-ore-${i}`, "ore"));
		}
		if (!Array.isArray(this.materials)) {
			throw new Error("generateMaterialInventory did not return an array");
		}
		MaterialRegistry.instance.registerMaterials(this.materials);
		const copperFreq = 0.2;
		const copperThreshold = 0.65;
		const treeFreq = 0.25;
		const treeThreshold = 0.65;

		this.map = Array.from({ length: this.width }, () =>
			Array(this.height).fill(0),
		);

		const noise1 = createNoise2D(Math.random);
		const noise2 = createNoise2D(Math.random);
		const noise3 = createNoise2D(Math.random);
		const noise4 = createNoise2D(Math.random);

		const freq1 = 0.015,
			freq2 = 0.035,
			freq3 = 0.08;
		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				const n1 = noise1(x * freq1, y * freq1) * 1.0;
				const n2 = noise2(x * freq2, y * freq2) * 0.5;
				const n3 = noise3(x * freq3, y * freq3) * 0.25;
				const elevation = (n1 + n2 + n3) / (1 + 0.5 + 0.25) + 0.5;
				this.map[x][y] = elevation;
			}
		}

		this.engine.debug.info("finish elevation map");

		this.cellularSmooth(8);
		this.engine.debug.info("finish smooth map");

		this.tiles = new Array(this.width);
		for (let x = 0; x < this.width; x++) {
			this.tiles[x] = [];
			for (let y = 0; y < this.height; y++) {
				const elev = this.map[x][y];
				const tile: Tile = {
					fg: undefined,
					bg: undefined,
					char: " ",
					boundary: false,
					mask: null,
					kind: TileKinds.grass,
				};

				if (elev <= 0) {
					tile.fg = COLORS().water.close;
					tile.char = "~";
					tile.boundary = true;
					tile.kind = TileKinds.water;
				} else if (elev > 0.7) {
					const cNoise = noise4(x * copperFreq, y * copperFreq);
					const oNoise = noise4(x * 0.01, y * 0.01);
					if (cNoise > copperThreshold) {
						tile.fg = COLORS().copper.close;
						tile.char = "#";
						tile.kind = TileKinds.copper;
					} else {
						tile.fg = COLORS().rock.close;
						tile.char = "#";
						tile.kind = TileKinds.rock;
					}
				} else {
					const tNoise = noise4(x * treeFreq, y * treeFreq);
					const bNoise = noise4(x * copperFreq, y * copperFreq);
					tile.fg = COLORS().grass.close;
					tile.char = ".";
					if (y - 1 > 0 && tNoise > treeThreshold) {
						tile.promotable = { type: "destructable,collectable", health: 15 };
						tile.mask = {
							fg: COLORS().wood.close,
							bg: "",
							char: "♣",
							kind: TileKinds.wood,
							promotable: tile.promotable,
						};
					} else if (bNoise > 0.85) {
						tile.promotable = { type: "destructable,collectable", health: 15 };
						tile.mask = {
							fg: COLORS().berry.close,
							bg: "",
							char: "o",
							kind: TileKinds.berry,
							promotable: tile.promotable,
						};
					}
				}
				this.tiles[x].push(tile);
			}
		}
		this.engine.debug.info("finish map assignments");
		this.orePass();
		this.engine.debug.info("finish ore pass");
		await this.buildClusters();
		this.engine.debug.info("finish clusters");
		return { state: true, message: "Map created" };
	}
	private samplePoisson(lambda: number, rng: seedrandom.PRNG): number {
		const L = Math.exp(-lambda);
		let k = 0;
		let p = 1;
		do {
			k++;
			p *= rng();
		} while (p > L);
		return k - 1;
	}
	private growDeposit(
		seedx: number,
		seedy: number,
		targetCells: number,
		expandProb: number,
		rng: seedrandom.PRNG,
	) {
		const key = (x: number, y: number) => `${x}-${y}`;
		let deposit = ImmutableSet([key(seedx, seedy)]);
		const allocated: [number, number][] = [[seedx, seedy]];

		while (deposit.size < targetCells) {
			if (allocated.length === 0) break;
			const id = Math.floor(rng() * allocated.length);
			const [cx, cy] = allocated.splice(id, 1)[0];
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) {
						continue;
					}
					const nx = cx + dx;
					const ny = cy + dy;
					const nkey = key(nx, ny);
					if (!deposit.has(nkey) && rng() < expandProb) {
						if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
							deposit = deposit.add(nkey);
							allocated.push([nx, ny]);
							if (deposit.size >= targetCells) break;
						}
					}
				}
				if (deposit.size >= targetCells) break;
			}
		}
		return deposit;
	}
	private orePass() {
		for (const material of this.materials.filter((m) => m.type === "ore")) {
			const rng = seedrandom(`${material.name}-ore-pass`);
			const lambda = material.depositFrequency * this.mapAreaKm2;
			const num_seeds = this.samplePoisson(lambda, rng);
			const targetCells = Math.ceil(material.typicalDepositSize);
			const expandProb = 0.2 * (1 - material.properties.rarity) + 0.1;

			for (let i = 0; i < num_seeds; i++) {
				const sx = Math.floor(rng() * this.width);
				const sy = Math.floor(rng() * this.height);

				const deposit = this.growDeposit(sx, sy, targetCells, expandProb, rng);
				for (const cell of deposit.values()) {
					const [x, y] = cell.split("-").map(Number);
					const tile = this.tiles[x][y];
					if (tile.kind === TileKinds.rock) {
						if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
							this.tiles[x][y].kind = TileKinds.ore;
							this.tiles[x][y].fg = undefined; // Let renderer handle color dynamically
							this.tiles[x][y].char = ":";
							this.tiles[x][y].oreName = material.name;
						}
					}
				}
			}
		}
	}
	public viewableDistance(): number {
		const player = this.engine.player;
		const distance = Math.sqrt(
			player.position.x * player.position.x +
				player.position.y * player.position.y,
		);

		const maxViewRadius = Math.floor(
			(player.air / 100) * GMap.VIEW_RADIUS_BASE,
		);

		const maxDetailedViewDistance = maxViewRadius + GMap.DITHER_RADIUS;

		return Math.floor(Math.min(distance, maxDetailedViewDistance));
	}

	public async loadMap(id: string): Promise<boolean> {
		const db = new DB(this.convex);
		this.tiles = await db.loadTiles(id);
		this.computedClusters = await db.loadClusters(id);
		this.buildClusterIndex();

		// Extract unique ore names from loaded tiles and regenerate materials
		const oreNames = new Set<string>();
		for (let x = 0; x < this.tiles.length; x++) {
			for (let y = 0; y < this.tiles[x].length; y++) {
				const tile = this.tiles[x][y];
				if (tile.kind === TileKinds.ore && tile.oreName) {
					oreNames.add(tile.oreName);
				}
			}
		}

		// Regenerate materials for found ore names
		this.materials = [];
		for (const oreName of oreNames) {
			// Use the ore name as seed to recreate the same material
			const material = makeMaterial(oreName, "ore");
			this.materials.push(material);
		}

		// Register the materials so GPU renderer can find them
		if (this.materials.length > 0) {
			MaterialRegistry.instance.registerMaterials(this.materials);

			// Invalidate GPU color cache so it picks up the new materials
			this.gpu.invalidateColorCache();
		}

		this.saved = true;
		return true;
	}

	async buildClusters() {
		this.computedClusters = await this.findClusters();
		this.engine.debug.info("done workers");
		const db = new DB(this.convex);
		this.mapId = await db.saveTileHeader(this.width, this.height);
		this.buildClusterIndex();
		this.engine.scheduler.add(
			{
				act: async () => {
					await db.saveTiles(this.mapId, this.tiles);
					await db.saveClusters(this.mapId, this.computedClusters);
					this.saved = true;
					await this.flushWriteQueue();
					this.engine.debug.info("saved");
				},
			},
			false,
		);
	}

	interpolateColor(color1: string, color2: string, factor: number): string {
		const hexToRgb = (hex: string) => {
			const bigint = parseInt(hex.slice(1), 16);
			return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
		};

		const rgbToHex = (rgb: number[]) => {
			return `#${rgb.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
		};

		const c1 = hexToRgb(color1);
		const c2 = hexToRgb(color2);
		const interpolated = c1.map((v, i) => Math.round(v + (c2[i] - v) * factor));

		return rgbToHex(interpolated);
	}

	dither(
		total_dist: number,
		hi_dist: number,
		dith_dist: number,
		steps: number,
		start: string,
		end: string,
	) {
		const factor = (total_dist - hi_dist) / dith_dist;
		const step = Math.min(Math.floor(factor * steps), steps - 1);
		const start_interp = this.interpolateColor(start, end, step / steps);
		const end_interp = this.interpolateColor(start, end, (step + 1) / steps);
		return this.interpolateColor(
			start_interp,
			end_interp,
			factor * steps - step,
		);
	}

	public VIEW_RADIUS = GMap.VIEW_RADIUS_BASE;

	// Fixed GPU render method
	async GPURender() {
		try {
			const vp = this.engine.viewport();

			const pixels = await this.gpu.render(
				this.tiles,
				this.engine.player.position,
				vp,
				this.VIEW_RADIUS,
			);

			this.engine.display.clear();

			for (const pixel of pixels) {
				this.engine.display.draw(
					pixel.x,
					pixel.y,
					pixel.char,
					pixel.fg,
					pixel.bg,
				);
			}
		} catch (error) {
			this.engine.debug.error(`GPU render failed: ${error}`);
			this.renderCPU(); // Fallback to CPU rendering
		}
	}

	// CPU fallback rendering
	renderCPU() {
		const STEPS = GMap.DITHER_STEPS;
		const DITHER_RADIUS = GMap.DITHER_RADIUS;
		const SUPER_FAR_RADIUS = GMap.SUPER_FAR_RADIUS;

		const vp = this.engine.viewport();
		this.engine.display.clear();

		// Collect light sources
		const lights = this.collectLightSources(vp);

		for (let sx = 0; sx < VIEWPORT.x; sx++) {
			for (let sy = 0; sy < VIEWPORT.y; sy++) {
				const wx = vp.x + sx;
				const wy = vp.y + sy;
				const tile = this.tiles[wx][wy];

				const dx = wx - this.engine.player.position.x;
				const dy = wy - this.engine.player.position.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				let cols: { close: string; far: string; superFar: string };
				if (
					tile.kind === TileKinds.ore &&
					tile.oreName &&
					(
						COLORS() as Record<
							string,
							{ close: string; far: string; superFar: string }
						>
					)[tile.oreName]
				) {
					cols = (
						COLORS() as Record<
							string,
							{ close: string; far: string; superFar: string }
						>
					)[tile.oreName];
				} else {
					const kindName = TileKinds[tile.kind] as keyof typeof COLORS;
					cols = COLORS()[kindName];
				}
				if (tile.mask != null) {
					const maskKindName = TileKinds[tile.mask.kind] as keyof typeof COLORS;
					cols = COLORS()[maskKindName];
				}

				let fg = "";
				if (dist <= this.VIEW_RADIUS) {
					fg = cols.close;
				} else if (dist <= this.VIEW_RADIUS + DITHER_RADIUS) {
					fg = this.dither(
						dist,
						this.VIEW_RADIUS,
						DITHER_RADIUS,
						STEPS,
						cols.close,
						cols.far,
					);
				} else if (dist <= SUPER_FAR_RADIUS) {
					const factor =
						(dist - (this.VIEW_RADIUS + DITHER_RADIUS)) /
						(SUPER_FAR_RADIUS - this.VIEW_RADIUS - DITHER_RADIUS);
					fg = this.interpolateColor(cols.far, cols.superFar, factor);
				} else {
					fg = cols.superFar;
				}

				// Apply light contributions
				fg = this.applyLightContributions(wx, wy, fg, lights);

				const ch = tile.mask?.char ?? tile.char;
				this.engine.display.draw(sx, sy, ch, fg, tile.bg);
			}
		}
	}

	private collectLightSources(viewport: Vec2d): LightSource[] {
		const lightEmitters = EntityRegistry.instance.lookup([
			LightEmitter,
			Movable,
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
		}

		return lights;
	}

	private hexToRgb(hex: string): [number, number, number] {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? [
					parseInt(result[1], 16),
					parseInt(result[2], 16),
					parseInt(result[3], 16),
				]
			: [0, 0, 0];
	}

	private rgbToHex(r: number, g: number, b: number): string {
		return (
			"#" +
			Math.round(r).toString(16).padStart(2, "0") +
			Math.round(g).toString(16).padStart(2, "0") +
			Math.round(b).toString(16).padStart(2, "0")
		);
	}

	private interpolateColorRgb(
		color1: [number, number, number],
		color2: [number, number, number],
		factor: number,
	): [number, number, number] {
		const clampedFactor = Math.max(0, Math.min(1, factor));
		return [
			color1[0] + (color2[0] - color1[0]) * clampedFactor,
			color1[1] + (color2[1] - color1[1]) * clampedFactor,
			color1[2] + (color2[2] - color1[2]) * clampedFactor,
		];
	}

	private applyLightContributions(
		worldX: number,
		worldY: number,
		baseColor: string,
		lights: LightSource[],
	): string {
		// If no lights, return the distance-based color unchanged
		if (lights.length === 0) {
			return baseColor;
		}

		// Check if any light affects this tile
		let hasLightInfluence = false;
		for (const light of lights) {
			const lightDx = worldX - light.x;
			const lightDy = worldY - light.y;
			const lightDist = Math.sqrt(lightDx * lightDx + lightDy * lightDy);
			if (lightDist <= light.radius) {
				hasLightInfluence = true;
				break;
			}
		}

		// If no lights affect this tile, return original distance-based color
		if (!hasLightInfluence) {
			return baseColor;
		}

		// Get the tile to determine its "close" (bright) color
		const tile = this.tiles[worldX][worldY];
		const kindName = TileKinds[tile.kind] as keyof typeof COLORS;
		let tileColors = COLORS()[kindName];
		if (tile.mask != null) {
			const maskKindName = TileKinds[tile.mask.kind] as keyof typeof COLORS;
			tileColors = COLORS()[maskKindName];
		}

		let resultColor = baseColor;
		let maxLightInfluence = 0;

		// Process each light source that affects this tile
		for (const light of lights) {
			const lightDx = worldX - light.x;
			const lightDy = worldY - light.y;
			const lightDist = Math.sqrt(lightDx * lightDx + lightDy * lightDy);

			// Only apply light if within radius
			if (lightDist <= light.radius) {
				// Use exact same logic as player's view distance
				const innerRadius = light.radius * 0.6; // 60% of radius is full strength
				const ditherRadius = light.radius * 0.4; // 40% of radius for dithering

				// Calculate blend based on neutral percentage
				const neutralPercentage = light.neutralPercentage ?? 0;
				const lightRgb = this.hexToRgb(light.color);
				const tileRgb = this.hexToRgb(tileColors.close);

				// Blend between natural tile color and light color
				const naturalBlend = neutralPercentage;
				const lightBlend = 1.0 - neutralPercentage;
				const brightColor = this.rgbToHex(
					tileRgb[0] * naturalBlend + lightRgb[0] * lightBlend,
					tileRgb[1] * naturalBlend + lightRgb[1] * lightBlend,
					tileRgb[2] * naturalBlend + lightRgb[2] * lightBlend,
				);

				let lightColor: string;
				if (lightDist <= innerRadius) {
					// Full bright color in inner radius (same as player's close range)
					lightColor = brightColor;
				} else {
					// Apply dithering in outer radius (same as player's dither range)
					lightColor = this.dither(
						lightDist,
						innerRadius,
						ditherRadius,
						GMap.DITHER_STEPS,
						brightColor, // Start with bright light color
						baseColor, // Dither to distance-based color
					);
				}

				// Use the strongest light influence
				const lightInfluence =
					lightDist <= innerRadius
						? 1.0
						: Math.max(0, 1.0 - (lightDist - innerRadius) / ditherRadius);

				if (lightInfluence > maxLightInfluence) {
					maxLightInfluence = lightInfluence;
					resultColor = lightColor;
				}
			}
		}

		return resultColor;
	}

	// Fixed: Make render async or handle promise properly
	async render() {
		if (this.useGPU) return await this.GPURender();
		this.renderCPU();
	}

	// Alternative: If you want synchronous render
	// render() {
	//     this.renderCPU();
	// }

	private clusterIndex?: Map<string, Cluster>;

	public buildClusterIndex() {
		const clusters = this.computedClusters;
		this.clusterIndex = new Map();

		for (const kind of Object.keys(this.computedClusters) as Array<
			keyof Clusters
		>) {
			for (const cluster of this.computedClusters[kind]) {
				for (const pt of cluster.points) {
					const key = `${pt.x},${pt.y}`;
					this.clusterIndex.set(key, cluster);
				}
			}
		}
	}

	public getClusterAt(pt: Vec2d): Cluster | undefined {
		if (!this.clusterIndex) this.buildClusterIndex();
		const t = this.clusterIndex?.get(`${pt.x},${pt.y}`);
		if (t?.kind === TileKinds.wood || t?.kind === TileKinds.leafs)
			return { ...t, kind: TileKinds.tree };
		return t;
	}
	private async findClusters(): Promise<Clusters> {
		const clusters: Clusters = {
			[TileKinds.grass]: [],
			[TileKinds.water]: [],
			[TileKinds.rock]: [],
			[TileKinds.copper]: [],
			[TileKinds.wood]: [],
			[TileKinds.leafs]: [],
			[TileKinds.struct]: [],
			[TileKinds.tree]: [],
			[TileKinds.berry]: [],
			[TileKinds.ore]: [],
		};

		// Fallback to synchronous if workers not available

		const numWorkers = Math.min(navigator.hardwareConcurrency || 4, this.width);
		const chunkSize = Math.ceil(this.width / numWorkers);

		const workerPromises: Promise<
			Map<number, Array<{ x: number; y: number; kind: number }>>
		>[] = [];

		for (let i = 0; i < numWorkers; i++) {
			const startX = i * chunkSize;
			const endX = Math.min(startX + chunkSize, this.width);

			if (startX >= this.width) break;

			const promise = this.processChunkWithWorker(startX, endX);
			workerPromises.push(promise);
		}

		try {
			this.engine.debug.info("awaiting workers");
			const chunkResults = await Promise.all(workerPromises);

			// Merge results from all workers
			const globalClusterMap = new Map<
				number,
				Array<{ x: number; y: number; kind: number }>
			>();

			for (const chunkMap of chunkResults) {
				for (const [root, points] of chunkMap) {
					if (!globalClusterMap.has(root)) {
						globalClusterMap.set(root, []);
					}
					globalClusterMap.get(root)!.push(...points);
				}
			}

			// Convert to final cluster format
			for (const points of globalClusterMap.values()) {
				if (points.length === 0) continue;

				const kind = points[0].kind as Exclude<TileKinds, TileKinds.cursor>;
				let sumX = 0,
					sumY = 0;

				for (const point of points) {
					sumX += point.x;
					sumY += point.y;
				}

				const center = {
					x: Math.floor(sumX / points.length),
					y: Math.floor(sumY / points.length),
				};

				if (clusters[kind]) {
					(clusters[kind] as Cluster[]).push({
						kind,
						points: points.map((p) => ({ x: p.x, y: p.y })),
						center, // center is already a plain object { x, y }
					});
				} else {
					console.warn(`Unknown cluster kind: ${kind}`);
				}
			}

			return clusters;
		} catch (error) {
			this.engine.debug.warn(
				`Worker clustering failed, falling back to synchronous: ${error}`,
			);
		}
		// Fallback: always return clusters object
		return clusters;
	}
	private async processClusterRemoval(clusterToRemove: Cluster): Promise<void> {
		if (!clusterToRemove) return;

		const { kind, center } = clusterToRemove;

		// 1. Find and remove the cluster from the main array
		const clusterArray = this.computedClusters[kind];
		const indexToRemove = clusterArray.findIndex(
			(c) => c.center.x === center.x && c.center.y === center.y,
		);

		if (indexToRemove > -1) {
			clusterArray.splice(indexToRemove, 1);
			this.engine.debug.info(
				`Removed cluster of kind ${TileKinds[kind]} from memory.`,
			);
		}

		// 2. Remove all points from the lookup index
		for (const p of clusterToRemove.points) {
			const key = `${p.x},${p.y}`;
			this.clusterIndex.delete(key);
		}

		// 3. Save the updated clusters object to the database
		const db = new DB(this.convex);
		await db.updateClusters(this.mapId, this.computedClusters);
		this.engine.debug.info(
			`Updated clusters in database for mapId: ${this.mapId}`,
		);
	}

	public queueClusterRemoval(clusterToRemove: Cluster): void {
		this.clusterQueue.push({ operation: "remove", cluster: clusterToRemove });
		this.scheduleAutoFlush();
	}

	public async removeCluster(clusterToRemove: Cluster): Promise<void> {
		// For backward compatibility, queue the removal instead of processing immediately
		this.queueClusterRemoval(clusterToRemove);
	}

	private processChunkWithWorker(
		startX: number,
		endX: number,
	): Promise<Map<number, Array<{ x: number; y: number; kind: number }>>> {
		return new Promise((resolve, reject) => {
			const worker = new Worker("/worker.js");
			const taskId = Math.random().toString(36).substr(2, 9);

			// Extract tile chunk
			const tilesChunk = this.tiles.slice(startX, endX);

			const timeout = setTimeout(() => {
				worker.terminate();
				reject(new Error("Worker timeout"));
			}, 30000); // 30 second timeout

			worker.onmessage = (event) => {
				const { taskId: responseId, success, clusters, error } = event.data;

				if (responseId !== taskId) return;

				clearTimeout(timeout);
				worker.terminate();

				if (success) {
					const clusterMap = new Map<
						number,
						Array<{ x: number; y: number; kind: number }>
					>(clusters);
					resolve(clusterMap);
				} else {
					reject(new Error(error));
				}
			};

			worker.onerror = (error) => {
				clearTimeout(timeout);
				worker.terminate();
				reject(error);
			};

			worker.postMessage({
				taskId,
				startX,
				endX,
				width: this.width,
				height: this.height,
				tilesChunk,
			});
		});
	}

	worldToViewport(
		worldX: number,
		worldY: number,
	): { x: number; y: number } | null {
		const viewport = this.getViewport();
		const viewportX = worldX - viewport.x;
		const viewportY = worldY - viewport.y;

		if (
			viewportX >= 0 &&
			viewportX < VIEWPORT.x &&
			viewportY >= 0 &&
			viewportY < VIEWPORT.y
		) {
			return { x: viewportX, y: viewportY };
		}

		return null; // Outside viewport
	}

	viewportToWorld(
		viewportX: number,
		viewportY: number,
	): { x: number; y: number } {
		const viewport = this.getViewport();
		return {
			x: viewport.x + viewportX,
			y: viewport.y + viewportY,
		};
	}
	private cellularSmooth(passes: number) {
		const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
		const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

		for (let pass = 0; pass < passes; pass++) {
			const newMap = this.map.map((col) => col.slice());
			for (let x = 1; x < this.width - 1; x++) {
				for (let y = 1; y < this.height - 1; y++) {
					const isLand = this.map[x][y] > 0;
					let landCount = 0;
					for (let i = 0; i < 8; i++) {
						if (this.map[x + dx[i]][y + dy[i]] > 0) landCount++;
					}
					if (isLand && landCount < 3) {
						newMap[x][y] = -0.1;
					} else if (!isLand && landCount > 4) {
						newMap[x][y] = 0.1;
					}
				}
			}
			this.map = newMap;
		}
	}
}
