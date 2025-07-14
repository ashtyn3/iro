import type { ConvexClient } from "convex/browser";
import { createNoise2D } from "simplex-noise";
import { api } from "~/convex/_generated/api";
import { EntityRegistry } from "./entity";
import { GPURenderer } from "./gpu";
import type { Engine } from "./index";
import { DB, Vec2d } from "./state";
import { LightEmitter, type LightSource, Movable } from "./traits";

export const COLORS = {
	grass: {
		close: "#5C8A34",
		far: "#0F1A0B",
		superFar: "#050805",
	},
	water: {
		close: "#3A6EA5",
		far: "#0A111B",
		superFar: "#05080D",
	},
	rock: {
		close: "#7D7D7D",
		far: "#111111",
		superFar: "#050505",
	},
	copper: {
		close: "#8C5A2B",
		far: "#120B05",
		superFar: "#070402",
	},
	wood: {
		close: "#A67C52",
		far: "#1A1008",
		superFar: "#080503",
	},
	leafs: {
		close: "#4F7C45",
		far: "#0A0F08",
		superFar: "#030503",
	},
	struct: {
		close: "#7D7D7D",
		far: "#111111",
		superFar: "#050505",
	},
	tree: {
		close: "#4F7C45",
		far: "#0A0F08",
		superFar: "#030503",
	},
	berry: {
		close: "#C53030",
		far: "#661818",
		superFar: "#1F0808",
	},
};
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
}

export const VIEWPORT: Vec2d = Vec2d({ x: 80, y: 40 });

export type Cluster = {
	kind: TileKinds;
	points: Vec2d[];
	center: Vec2d;
};

export type Clusters = {
	[key in TileKinds]: Cluster[];
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
}

export class GMap {
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
		};
		this.map = [];
		this.saved = false;
		this.writeQueue = [];
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
	// async updateViewportTiles(newTiles: Tile[][]): Promise<void> {
	//     const viewport = this.getViewport();
	//
	//     // Validate dimensions
	//     if (newTiles.length !== viewport.width ||
	//         newTiles.some(row => row.length !== viewport.height)) {
	//         throw new Error("New tiles dimensions don't match viewport");
	//     }
	//
	//     // Update local tiles array
	//     for (let vx = 0; vx < viewport.width; vx++) {
	//         for (let vy = 0; vy < viewport.height; vy++) {
	//             const worldX = viewport.x + vx;
	//             const worldY = viewport.y + vy;
	//
	//             if (worldX < this.width && worldY < this.height) {
	//                 this.tiles[worldX][worldY] = newTiles[vx][vy];
	//             }
	//         }
	//     }
	//
	//     // Update database if tiles were loaded from DB
	//     if (this.mapId) {
	//         const db = new DB(this.convex);
	//         await db.updateVisibleTiles(this.mapId, viewport, newTiles);
	//     }
	// }
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

		// Update local array
		this.tiles[worldX][worldY] = newTile;

		// Update database
		if (this.mapId) {
			const db = new DB(this.convex);
			if (this.saved) {
				await db.updateViewportTiles(this.mapId, viewport, [
					{ x: viewportX, y: viewportY, tile: newTile },
				]);
			} else {
				this.writeQueue.push({ x: viewportX, y: viewportY, tile: newTile });
			}
		}
	}
	async flushWriteQueue() {
		this.engine.debug.info(`flushing write queue ${this.writeQueue.length}`);
		if (this.writeQueue.length > 0) {
			const db = new DB(this.convex);
			await db.updateViewportTiles(
				this.mapId,
				this.getViewport(),
				this.writeQueue,
			);
			this.writeQueue = [];
		}
	}
	async genMap(): Promise<{ state: boolean; message: string }> {
		const canMakeMap = await this.convex.query(
			api.functions.saveTileSet.canMakeMap,
			{},
		);
		if (!canMakeMap.state) {
			return { state: false, message: canMakeMap.message };
		}
		const noise1 = createNoise2D(Math.random);
		const noise2 = createNoise2D(Math.random);
		const noise3 = createNoise2D(Math.random);
		const noise4 = createNoise2D(Math.random);

		const copperFreq = 0.2;
		const copperThreshold = 0.65;
		const treeFreq = 0.25;
		const treeThreshold = 0.65;

		this.map = Array.from({ length: this.width }, () =>
			Array(this.height).fill(0),
		);

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
					tile.fg = COLORS.water.close;
					tile.char = "~";
					tile.boundary = true;
					tile.kind = TileKinds.water;
				} else if (elev > 0.7) {
					const cNoise = noise4(x * copperFreq, y * copperFreq);
					if (cNoise > copperThreshold) {
						tile.fg = COLORS.copper.close;
						tile.char = "#";
						tile.kind = TileKinds.copper;
					} else {
						tile.fg = COLORS.rock.close;
						tile.char = "#";
						tile.kind = TileKinds.rock;
					}
				} else {
					const tNoise = noise4(x * treeFreq, y * treeFreq);
					const bNoise = noise4(x * copperFreq, y * copperFreq);
					tile.fg = COLORS.grass.close;
					tile.char = ".";
					if (
						y - 1 > 0 &&
						tNoise > treeThreshold &&
						this.tiles[x][y - 1].mask == null
					) {
						tile.promotable = { type: "destructable,collectable", health: 15 };
						tile.mask = {
							fg: COLORS.wood.close,
							bg: "",
							char: "$",
							kind: TileKinds.wood,
							promotable: tile.promotable,
						};
						this.tiles[x][y - 1].promotable = tile.promotable;
						this.tiles[x][y - 1].mask = {
							fg: COLORS.leafs.close,
							bg: "",
							char: "^",
							kind: TileKinds.leafs,
							promotable: tile.promotable,
						};
					} else if (bNoise > 0.85) {
						tile.promotable = { type: "destructable,collectable", health: 15 };
						tile.mask = {
							fg: COLORS.berry.close,
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
		await this.buildClusters();
		this.engine.debug.info("finish clusters");
		return { state: true, message: "Map created" };
	}

	public async loadMap(id: string): Promise<boolean> {
		const db = new DB(this.convex);
		this.tiles = await db.loadTiles(id);
		this.computedClusters = await db.loadClusters(id);
		this.buildClusterIndex();
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

	public VIEW_RADIUS = 10;

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

			// Fixed: Use 'of' instead of 'in'
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
		const STEPS = 5;
		const DITHER_RADIUS = 5;
		const SUPER_FAR_RADIUS = 20;

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

				// Fixed: Use proper key lookup
				const kindName = TileKinds[tile.kind] as keyof typeof COLORS;
				let cols = COLORS[kindName];
				if (tile.mask != null) {
					const maskKindName = TileKinds[tile.mask.kind] as keyof typeof COLORS;
					cols = COLORS[maskKindName];
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
		let baseRgb = this.hexToRgb(baseColor);

		// Process each light source
		for (const light of lights) {
			const lightDx = worldX - light.x;
			const lightDy = worldY - light.y;
			const lightDist = Math.sqrt(lightDx * lightDx + lightDy * lightDy);

			// Only apply light if within radius
			if (lightDist <= light.radius) {
				const lightRgb = this.hexToRgb(light.color);
				const lightFalloff = 1.0 - lightDist / light.radius;
				const lightStrength = light.intensity * lightFalloff * lightFalloff; // Quadratic falloff

				// Blend light color with base color
				baseRgb = this.interpolateColorRgb(
					baseRgb,
					lightRgb,
					lightStrength * 0.5,
				);
			}
		}

		return this.rgbToHex(baseRgb[0], baseRgb[1], baseRgb[2]);
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

		for (const kind of Object.keys(this.computedClusters) as TileKinds[]) {
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
		const t = this.clusterIndex.get(`${pt.x},${pt.y}`);
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

				const kind = points[0].kind;
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

				clusters[kind].push({
					kind,
					points: points.map((p) => ({ x: p.x, y: p.y })),
					center,
				});
			}

			return clusters;
		} catch (error) {
			this.engine.debug.warn(
				`Worker clustering failed, falling back to synchronous: ${error}`,
			);
		}
	}
	public async removeCluster(clusterToRemove: Cluster): Promise<void> {
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
					const clusterMap = new Map(clusters);
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
