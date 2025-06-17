import type { Vec2d } from "./entity";
import type { Engine } from "./index";
import { createNoise2D } from "simplex-noise";
import { DB } from "./state";
import { GPURenderer } from "./gpu";

export const COLORS = {
    grass: {
        close: "#5C8A34",
        far: "#2E552B",
        superFar: "#1A291A"
    },
    water: {
        close: "#3A6EA5",
        far: "#2A4E75",
        superFar: "#172C48"
    },
    rock: {
        close: "#7D7D7D",
        far: "#4D4D4D",
        superFar: "#2F2F2F"
    },
    copper: {
        close: "#8C5A2B",
        far: "#5F3F19",
        superFar: "#3C270F"
    },
    wood: {
        close: "#A67C52",
        far: "#7A5634",
        superFar: "#4F331E"
    },
    leafs: {
        close: "#4F7C45",
        far: "#1D371A",
        superFar: "#0F1E0F"
    },
    struct: {
        close: "#7D7D7D",
        far: "#4D4D4D",
        superFar: "#2F2F2F"
    },
    tree: {
        close: "#4F7C45",
        far: "#1D371A",
        superFar: "#0F1E0F"
    }
};

export const enum TileKinds {
    grass,
    water,
    rock,
    copper,
    wood,
    leafs,
    struct,
    tree
}

export const VIEWPORT: Vec2d = { x: 120, y: 55 };

export type Cluster = {
    kind: TileKinds;
    points: Vec2d[];
    center: Vec2d;
};

export type Clusters = {
    [key in TileKinds]: Cluster[];
};

export interface promotion {
    type: string
    [key: string]: any
}
export interface Tile {
    fg?: string;
    bg?: string;
    char: string;
    boundary: boolean;
    kind: TileKinds
    mask: { fg: string; bg: string; char: string, kind: TileKinds } | null;
    promotable?: promotion
}

export class GMap {
    width: number;
    height: number;
    map: number[][];
    engine: Engine;
    tiles: Tile[][];
    computedClusters: Clusters;
    gpu: GPURenderer
    useGPU: boolean
    mapId: number

    constructor(w: number, h: number, e: Engine, id: number = 1) {
        this.mapId = id
        this.gpu = new GPURenderer()
        this.useGPU = false
        this.width = w;
        this.height = h;
        this.engine = e;
        this.tiles = []
        this.computedClusters = {
            [TileKinds.grass]: [],
            [TileKinds.water]: [],
            [TileKinds.rock]: [],
            [TileKinds.copper]: [],
            [TileKinds.wood]: [],
            [TileKinds.leafs]: [],
            [TileKinds.struct]: [],
            [TileKinds.tree]: []
        }
        this.map = []
    }


    getViewport(): { x: number; y: number; width: number; height: number } {
        const vp = this.engine.viewport();
        return {
            x: vp.x,
            y: vp.y,
            width: VIEWPORT.x,
            height: VIEWPORT.y
        };
    }
    async updateViewportTiles(newTiles: Tile[][]): Promise<void> {
        const viewport = this.getViewport();

        // Validate dimensions
        if (newTiles.length !== viewport.width ||
            newTiles.some(row => row.length !== viewport.height)) {
            throw new Error("New tiles dimensions don't match viewport");
        }

        // Update local tiles array
        for (let vx = 0; vx < viewport.width; vx++) {
            for (let vy = 0; vy < viewport.height; vy++) {
                const worldX = viewport.x + vx;
                const worldY = viewport.y + vy;

                if (worldX < this.width && worldY < this.height) {
                    this.tiles[worldX][worldY] = newTiles[vx][vy];
                }
            }
        }

        // Update database if tiles were loaded from DB
        if (this.mapId) {
            const db = new DB();
            await db.updateVisibleTiles(this.mapId, viewport, newTiles);
        }
    }
    async updateViewportTile(
        viewportX: number,
        viewportY: number,
        newTile: Tile
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
            const db = new DB();
            await db.updateViewportTiles(this.mapId, viewport, [
                { x: viewportX, y: viewportY, tile: newTile }
            ]);
        }
    }
    async genMap(): Promise<boolean> {
        const noise1 = createNoise2D(Math.random);
        const noise2 = createNoise2D(Math.random);
        const noise3 = createNoise2D(Math.random);
        const noise4 = createNoise2D(Math.random);

        const copperFreq = 0.20;
        const copperThreshold = 0.65;
        const treeFreq = 0.25;
        const treeThreshold = 0.65;

        this.map = Array.from({ length: this.width }, () =>
            Array(this.height).fill(0)
        );

        const freq1 = 0.015, freq2 = 0.035, freq3 = 0.08;
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const n1 = noise1(x * freq1, y * freq1) * 1.0;
                const n2 = noise2(x * freq2, y * freq2) * 0.5;
                const n3 = noise3(x * freq3, y * freq3) * 0.25;
                const elevation = (n1 + n2 + n3) / (1 + 0.5 + 0.25) + 0.50;
                this.map[x][y] = elevation;
            }
        }
        console.log("finish elevation map")

        this.cellularSmooth(8);
        console.log("finish smooth map")

        this.tiles = new Array(this.width);
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < this.height; y++) {
                const elev = this.map[x][y];
                const tile: Tile = {
                    fg: null,
                    bg: null,
                    char: " ",
                    boundary: false,
                    mask: null,
                    kind: TileKinds.grass
                };

                if (elev <= 0) {
                    tile.fg = COLORS.water.close;
                    tile.char = "~";
                    tile.boundary = true;
                    tile.kind = TileKinds.water;
                } else if (elev > 0.70) {
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
                    tile.fg = COLORS.grass.close;
                    tile.char = ".";
                    if (y - 1 > 0 && tNoise > treeThreshold && this.tiles[x][y - 1].mask == null) {
                        tile.promotable = { type: "destructable,collectable", health: 15 }
                        tile.mask = {
                            fg: COLORS.wood.close,
                            bg: "",
                            char: "$",
                            kind: TileKinds.wood
                        }
                        this.tiles[x][y - 1].promotable = tile.promotable
                        this.tiles[x][y - 1].mask = {
                            fg: COLORS.leafs.close,
                            bg: "",
                            char: "^",
                            kind: TileKinds.leafs
                        }
                    }
                }
                this.tiles[x].push(tile);
            }
        }
        console.log("finish map assignments")
        await this.buildClusters();
        console.log("finish clusters")
        return true;
    }

    public async loadMap(id: number): Promise<boolean> {
        let db = new DB()
        this.tiles = await db.loadTiles(id)
        this.computedClusters = await db.loadClusters(id)
        this.buildClusterIndex()
        return true
    }

    async buildClusters() {
        this.computedClusters = await this.findClusters()
        let db = new DB()
        await db.saveTiles(this.tiles)
        await db.saveClusters(this.computedClusters)
        this.buildClusterIndex()
    }

    interpolateColor(color1: string, color2: string, factor: number): string {
        const hexToRgb = (hex: string) => {
            const bigint = parseInt(hex.slice(1), 16);
            return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
        };

        const rgbToHex = (rgb: number[]) => {
            return `#${rgb.map(x => x.toString(16).padStart(2, '0')).join('')}`;
        };

        const c1 = hexToRgb(color1);
        const c2 = hexToRgb(color2);
        const interpolated = c1.map((v, i) => Math.round(v + (c2[i] - v) * factor));

        return rgbToHex(interpolated);
    }

    dither(total_dist: number, hi_dist: number, dith_dist: number, steps: number, start: string, end: string) {
        const factor = (total_dist - hi_dist) / dith_dist
        const step = Math.min(Math.floor(factor * steps), steps - 1)
        const start_interp = this.interpolateColor(start, end, step / steps)
        const end_interp = this.interpolateColor(start, end, (step + 1) / steps)
        return this.interpolateColor(start_interp, end_interp, factor * steps - step)
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
                this.VIEW_RADIUS
            );

            this.engine.display.clear();

            // Fixed: Use 'of' instead of 'in'
            for (const pixel of pixels) {
                this.engine.display.draw(pixel.x, pixel.y, pixel.char, pixel.fg, pixel.bg);
            }
        } catch (error) {
            console.error('GPU render failed:', error);
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
                    fg = this.dither(dist, this.VIEW_RADIUS, DITHER_RADIUS, STEPS, cols.close, cols.far);
                } else if (dist <= SUPER_FAR_RADIUS) {
                    const factor = (dist - (this.VIEW_RADIUS + DITHER_RADIUS)) / (SUPER_FAR_RADIUS - this.VIEW_RADIUS - DITHER_RADIUS);
                    fg = this.interpolateColor(cols.far, cols.superFar, factor);
                } else {
                    fg = cols.superFar;
                }
                const ch = tile.mask?.char ?? tile.char;
                this.engine.display.draw(sx, sy, ch, fg, tile.bg);
            }
        }
    }

    // Fixed: Make render async or handle promise properly
    async render() {
        if (this.useGPU) return await this.GPURender()
        this.renderCPU()

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
        if (t?.kind === TileKinds.wood || t?.kind === TileKinds.leafs) return { ...t, kind: TileKinds.tree }
        return t
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
            [TileKinds.tree]: []
        };

        // Fallback to synchronous if workers not available

        const numWorkers = Math.min(navigator.hardwareConcurrency || 4, this.width);
        const chunkSize = Math.ceil(this.width / numWorkers);

        const workerPromises: Promise<Map<number, Array<{ x: number, y: number, kind: number }>>>[] = [];

        for (let i = 0; i < numWorkers; i++) {
            const startX = i * chunkSize;
            const endX = Math.min(startX + chunkSize, this.width);

            if (startX >= this.width) break;

            const promise = this.processChunkWithWorker(startX, endX);
            workerPromises.push(promise);
        }

        try {
            console.log("awaiting workers")
            const chunkResults = await Promise.all(workerPromises);

            // Merge results from all workers
            const globalClusterMap = new Map<number, Array<{ x: number, y: number, kind: number }>>();

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
                let sumX = 0, sumY = 0;

                for (const point of points) {
                    sumX += point.x;
                    sumY += point.y;
                }

                const center = {
                    x: Math.floor(sumX / points.length),
                    y: Math.floor(sumY / points.length)
                };

                clusters[kind].push({
                    kind,
                    points: points.map(p => ({ x: p.x, y: p.y })),
                    center
                });
            }

            return clusters;

        } catch (error) {
            console.warn('Worker clustering failed, falling back to synchronous:', error);
        }
    }
    public async removeCluster(clusterToRemove: Cluster): Promise<void> {
        if (!clusterToRemove) return;

        const { kind, center } = clusterToRemove;

        // 1. Find and remove the cluster from the main array
        const clusterArray = this.computedClusters[kind];
        const indexToRemove = clusterArray.findIndex(c =>
            c.center.x === center.x && c.center.y === center.y
        );

        if (indexToRemove > -1) {
            clusterArray.splice(indexToRemove, 1);
            console.log(`Removed cluster of kind ${TileKinds[kind]} from memory.`);
        }

        // 2. Remove all points from the lookup index
        for (const p of clusterToRemove.points) {
            const key = `${p.x},${p.y}`;
            this.clusterIndex.delete(key);
        }

        // 3. Save the updated clusters object to the database
        const db = new DB();
        // We need a way to UPDATE the clusters for the current mapId.
        await db.updateClusters(this.mapId, this.computedClusters);
        console.log(`Updated clusters in database for mapId: ${this.mapId}`);
    }

    private processChunkWithWorker(
        startX: number,
        endX: number
    ): Promise<Map<number, Array<{ x: number, y: number, kind: number }>>> {
        return new Promise((resolve, reject) => {
            const worker = new Worker('/worker.js');
            const taskId = Math.random().toString(36).substr(2, 9);

            // Extract tile chunk
            const tilesChunk = this.tiles.slice(startX, endX);

            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Worker timeout'));
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
                tilesChunk
            });
        });
    }


    worldToViewport(worldX: number, worldY: number): { x: number; y: number } | null {
        const viewport = this.getViewport();
        const viewportX = worldX - viewport.x;
        const viewportY = worldY - viewport.y;

        if (viewportX >= 0 && viewportX < VIEWPORT.x &&
            viewportY >= 0 && viewportY < VIEWPORT.y) {
            return { x: viewportX, y: viewportY };
        }

        return null; // Outside viewport
    }

    viewportToWorld(viewportX: number, viewportY: number): { x: number; y: number } {
        const viewport = this.getViewport();
        return {
            x: viewport.x + viewportX,
            y: viewport.y + viewportY
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
