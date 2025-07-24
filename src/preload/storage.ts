import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decode, encode } from "@msgpack/msgpack";
import { nanoid } from "nanoid";
import SuperJSON from "superjson";
import { defaultKeys } from "../renderer/src/default_keys";
import type { Cluster, Clusters } from "../renderer/src/lib/map";

export enum StoreType {
	Map = "map",
	Settings = "settings",
	Entities = "entities",
}

// Get the appropriate data directory for the app
function getDataDirectory(): string {
	// In development, use current directory
	if (process.env.NODE_ENV === "development") {
		return "./data";
	}

	// In production, use the user's home directory with app name
	return path.join(os.homedir(), "iro", "data");
}

const DIR_MAPPING: Record<StoreType, string> = {
	[StoreType.Map]: path.join(getDataDirectory(), "maps"),
	[StoreType.Settings]: path.join(getDataDirectory(), "settings"),
	[StoreType.Entities]: path.join(getDataDirectory(), "entities"),
};

function encodeToArrayBuffer(data: any): ArrayBuffer {
	const encoded = encode(data);
	return encoded.buffer.slice(
		encoded.byteOffset,
		encoded.byteOffset + encoded.byteLength,
	) as ArrayBuffer;
}

function decodeFromArrayBuffer(buffer: ArrayBuffer): any {
	const uint8Array = new Uint8Array(buffer);
	return decode(uint8Array);
}

// Helper function for compression
async function compressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
	const compressor = new CompressionStream("gzip");
	const writer = compressor.writable.getWriter();
	writer.write(data);
	writer.close();
	return await new Response(compressor.readable).arrayBuffer();
}

// Helper function for decompression
async function decompressGzip(
	compressedBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
	const decompressor = new DecompressionStream("gzip");
	const writer = decompressor.writable.getWriter();
	writer.write(compressedBuffer);
	writer.close();
	return await new Response(decompressor.readable).arrayBuffer();
}

export class Storage {
	private static _instance: Storage | null = null;

	private constructor() {
		if (Storage._instance) {
			return;
		}
		this.ensureMappings();
		Storage._instance = this;
	}

	public static get instance(): Storage {
		if (!Storage._instance) {
			Storage._instance = new Storage();
		}
		return Storage._instance;
	}

	private ensureMappings() {
		try {
			for (const type of Object.values(StoreType)) {
				const dir = DIR_MAPPING[type];
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			}
		} catch (error) {
			console.error("Failed to create data directories:", error);
			// Try to create at least the base directory
			try {
				const baseDir = getDataDirectory();
				if (!fs.existsSync(baseDir)) {
					fs.mkdirSync(baseDir, { recursive: true });
				}
			} catch (fallbackError) {
				console.error("Failed to create fallback directory:", fallbackError);
			}
		}
	}

	public async createTileSet({
		width,
		height,
		name,
	}: {
		width: number;
		height: number;
		name: string;
	}) {
		const mapDir = DIR_MAPPING[StoreType.Map];
		const mapId = nanoid();
		const mapPath = path.join(mapDir, mapId);
		fs.mkdirSync(mapPath, { recursive: true });
		fs.writeFileSync(
			path.join(mapPath, "map.data"),
			JSON.stringify({
				width,
				height,
				name,
				createdAt: new Date().toISOString(),
			}),
		);
		return mapId;
	}

	public async insertTileBlocks(
		tileSetId: string,
		blocks: Array<{ blockX: number; blockY: number; data: ArrayBuffer }>,
	) {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], tileSetId);
		for (const block of blocks) {
			const filePath = path.join(
				mapPath,
				`BLK.${block.blockX}.${block.blockY}.data`,
			);
			// Convert ArrayBuffer to Uint8Array for proper serialization
			const blockForEncoding = {
				blockX: block.blockX,
				blockY: block.blockY,
				data: new Uint8Array(block.data),
			};
			const encoded = encodeToArrayBuffer(blockForEncoding);
			fs.writeFileSync(filePath, new Uint8Array(encoded));
		}
	}

	public async updateViewportTiles(
		tileSetId: string,
		viewport: {
			x: number;
			y: number;
			width: number;
			height: number;
		},
		tileUpdates: Array<{
			x: number; // relative to viewport
			y: number; // relative to viewport
			tile: any;
		}>,
	) {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], tileSetId);
		const blockSize = 64;
		const blockUpdates = new Map<
			string,
			Array<{ localX: number; localY: number; tile: any }>
		>();

		// Group tile updates by block
		for (const upd of tileUpdates) {
			// Compute actual world coordinates
			const ax = viewport.x + upd.x;
			const ay = viewport.y + upd.y;

			// Determine which block this belongs to
			const bx = Math.floor(ax / blockSize);
			const by = Math.floor(ay / blockSize);
			const key = `${bx},${by}`;

			// Calculate local coordinates within the block
			const localX = ax - bx * blockSize;
			const localY = ay - by * blockSize;

			if (!blockUpdates.has(key)) {
				blockUpdates.set(key, []);
			}
			blockUpdates.get(key)!.push({ localX, localY, tile: upd.tile });
		}

		// Load existing blocks and apply updates
		const { blocks } = await this.loadMapContent(tileSetId);
		let updatedBlocksCount = 0;

		for (const [key, updates] of blockUpdates) {
			const [bx, by] = key.split(",").map(Number);

			try {
				// Find the specific block we need
				const block = blocks.find(
					(b: any) => b.blockX === bx && b.blockY === by,
				);
				let blockData: any[][];

				if (!block) {
					// Block doesn't exist, create a new empty block
					console.log(
						`Block (${bx},${by}) not found, creating new empty block`,
					);
					blockData = Array.from({ length: blockSize }, () =>
						Array.from({ length: blockSize }, () => ({
							char: " ",
							kind: 0,
							boundary: false,
							mask: null,
						})),
					);
				} else {
					// Try to decompress and decode the existing block
					try {
						const decompressedData = await decompressGzip(block.data);
						blockData = decode(new Uint8Array(decompressedData)) as any[][];
					} catch (decompressError) {
						// Fallback: try legacy ZSTD format
						try {
							const dataBytes = new Uint8Array(block.data);
							const zstd = await (
								await import("@oneidentity/zstd-js")
							).ZstdInit();
							const decompressedData = zstd.ZstdSimple.decompress(dataBytes);
							blockData = decode(decompressedData) as any[][];
						} catch (zstdError) {
							// Final fallback: try as plain JSON
							try {
								blockData = JSON.parse(new TextDecoder().decode(block.data));
							} catch (jsonError) {
								// Create new empty block if all decompression methods fail
								console.log(
									`Block (${bx},${by}) data is corrupted, creating new empty block`,
								);
								blockData = Array.from({ length: blockSize }, () =>
									Array.from({ length: blockSize }, () => ({
										char: " ",
										kind: 0,
										boundary: false,
										mask: null,
									})),
								);
							}
						}
					}
				}

				// Apply all updates for this block
				for (const { localX, localY, tile } of updates) {
					if (blockData[localX] && blockData[localX][localY] !== undefined) {
						blockData[localX][localY] = tile;
					}
				}

				// Re-compress and save the updated block
				const encodedData = encode(blockData);
				const compressedData = await compressGzip(
					encodedData.buffer.slice(
						encodedData.byteOffset,
						encodedData.byteOffset + encodedData.byteLength,
					),
				);

				const filePath = path.join(mapPath, `BLK.${bx}.${by}.data`);
				const blockForEncoding = {
					blockX: bx,
					blockY: by,
					data: new Uint8Array(compressedData),
				};
				const encoded = encodeToArrayBuffer(blockForEncoding);
				fs.writeFileSync(filePath, new Uint8Array(encoded));
				updatedBlocksCount++;
			} catch (error) {
				console.error(`Error processing block (${bx},${by}):`, error);
				throw error;
			}
		}

		return { updatedBlocks: updatedBlocksCount };
	}
	public async getAllMaps() {
		const mapDir = DIR_MAPPING[StoreType.Map];
		const directories = fs
			.readdirSync(mapDir, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		const maps: {
			id: string;
			width: number;
			height: number;
			createdAt: string;
		}[] = [];

		for (const dirName of directories) {
			const mapDataPath = path.join(mapDir, dirName, "map.data");
			if (fs.existsSync(mapDataPath)) {
				try {
					const data = fs.readFileSync(mapDataPath, "utf8");
					const mapData = JSON.parse(data) as {
						width: number;
						height: number;
						createdAt: string;
					};
					maps.push({
						id: dirName,
						...mapData,
					});
				} catch (error) {
					console.error(`Error reading map data for ${dirName}:`, error);
				}
			}
		}

		return maps.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}

	public async loadMapContent(mapId: string) {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);

		// Check if map directory exists
		if (!fs.existsSync(mapPath)) {
			throw new Error(`Map directory does not exist: ${mapPath}`);
		}

		const files = fs.readdirSync(mapPath);

		const blocks: { blockX: number; blockY: number; data: ArrayBuffer }[] = [];
		let header = { height: 0, width: 0 };

		for (const file of files) {
			if (file.startsWith("BLK.")) {
				const filePath = path.join(mapPath, file);
				const data = fs.readFileSync(filePath);

				// Convert Node.js Buffer to ArrayBuffer
				const arrayBuffer = data.buffer.slice(
					data.byteOffset,
					data.byteOffset + data.byteLength,
				);

				try {
					const decodedBlock = decodeFromArrayBuffer(arrayBuffer) as {
						blockX: number;
						blockY: number;
						data: Uint8Array | any;
					};

					// Handle both new format (Uint8Array) and old format (empty object or ArrayBuffer)
					let blockData: ArrayBuffer;

					if (decodedBlock.data instanceof Uint8Array) {
						// New format: data is Uint8Array
						blockData = decodedBlock.data.buffer.slice(
							decodedBlock.data.byteOffset,
							decodedBlock.data.byteOffset + decodedBlock.data.byteLength,
						);
					} else if (
						decodedBlock.data &&
						typeof decodedBlock.data === "object" &&
						decodedBlock.data.byteLength !== undefined
					) {
						// Old format: data might be ArrayBuffer-like
						blockData = decodedBlock.data;
					} else {
						// Fallback: data is empty object or undefined, skip this block
						continue;
					}

					const block: { blockX: number; blockY: number; data: ArrayBuffer } = {
						blockX: decodedBlock.blockX,
						blockY: decodedBlock.blockY,
						data: blockData,
					};

					blocks.push(block);
				} catch (error) {
					console.error(`Failed to decode block ${file}:`, error);
				}
			} else if (file === "map.data") {
				const filePath = path.join(mapPath, file);
				try {
					const data = fs.readFileSync(filePath, "utf8");
					const parsedData = JSON.parse(data) as {
						height: number;
						width: number;
						createdAt?: string;
					};
					header = { width: parsedData.width, height: parsedData.height };
				} catch (error) {
					console.error(`Failed to read map.data file: ${error}`);
					// Keep default header values
				}
			}
		}
		// Check if we found a valid map.data file
		if (header.width === 0 && header.height === 0) {
			console.error(`No valid map.data file found in ${mapPath}`);
			throw new Error(`No valid map metadata found for map ${mapId}`);
		}

		return { blocks, meta: header };
	}

	public async saveClusters(mapId: string, clusters: Clusters) {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);

		// Save each cluster group by kind using SuperJSON for proper Vec2d handling
		for (const [kindKey, clusterGroup] of Object.entries(clusters)) {
			const kind = parseInt(kindKey);
			const filePath = path.join(mapPath, `CLUSTER.${kind}.data`);
			const serialized = SuperJSON.stringify(clusterGroup);
			fs.writeFileSync(filePath, serialized, "utf8");
		}
	}

	public async loadCluster(mapId: string): Promise<Clusters> {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);
		const files = fs.readdirSync(mapPath);
		const clusters: Clusters = {} as Clusters;

		files.forEach((file) => {
			if (file.startsWith("CLUSTER.")) {
				const filePath = path.join(mapPath, file);
				const data = fs.readFileSync(filePath, "utf8");
				const kind = parseInt(file.split(".")[1]);
				try {
					const clusterGroup = SuperJSON.parse(data) as Cluster[];
					clusters[kind as keyof Clusters] = clusterGroup;
				} catch (error) {
					console.error(`Failed to parse cluster file ${file}:`, error);
					clusters[kind as keyof Clusters] = [];
				}
			}
		});
		return clusters;
	}

	public async clusterUpdate(tileSetId: string, clusters: any) {
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], tileSetId);

		// Get existing cluster files
		const existingFiles = fs.existsSync(mapPath) ? fs.readdirSync(mapPath) : [];
		const existingByKind = new Map<number, string>();

		// Parse existing cluster files to get kind -> filename mapping
		for (const file of existingFiles) {
			if (file.startsWith("CLUSTER.")) {
				const parts = file.split(".");
				if (parts.length >= 3) {
					const kind = parseInt(parts[1], 10);
					existingByKind.set(kind, file);
				}
			}
		}

		// Update or create clusters using SuperJSON
		for (const kindKey of Object.keys(clusters)) {
			const kind = parseInt(kindKey, 10);
			const cluster = clusters[kind];
			const serialized = SuperJSON.stringify(cluster);
			const fileName = `CLUSTER.${kind}.data`;

			if (existingByKind.has(kind)) {
				// Update existing cluster
				const filePath = path.join(mapPath, fileName);
				fs.writeFileSync(filePath, serialized, "utf8");
				existingByKind.delete(kind);
			} else {
				// Create new cluster
				const filePath = path.join(mapPath, fileName);
				fs.writeFileSync(filePath, serialized, "utf8");
			}
		}

		// Delete orphaned clusters (existing ones not in the new clusters)
		for (const orphanFileName of existingByKind.values()) {
			const orphanPath = path.join(mapPath, orphanFileName);
			fs.unlinkSync(orphanPath);
		}
	}

	public async saveEntityState(
		tileSetId: string,
		entityId: string,
		state: any,
	) {
		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);
		if (!fs.existsSync(entityPath)) {
			fs.mkdirSync(entityPath, { recursive: true });
		}

		const filePath = path.join(entityPath, `ENTITY.${entityId}.data`);
		const encoded = encodeToArrayBuffer(state);
		fs.writeFileSync(filePath, new Uint8Array(encoded));
	}

	public async getEntityState(
		tileSetId: string,
		entityId: string,
	): Promise<any | null> {
		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);
		const filePath = path.join(entityPath, `ENTITY.${entityId}.data`);

		if (!fs.existsSync(filePath)) {
			return null;
		}

		const data = fs.readFileSync(filePath);
		// Convert Node.js Buffer to ArrayBuffer
		const arrayBuffer = data.buffer.slice(
			data.byteOffset,
			data.byteOffset + data.byteLength,
		);
		return decodeFromArrayBuffer(arrayBuffer);
	}

	public async clearEntityStates(tileSetId: string) {
		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);

		// Check if the entity directory exists before trying to read it
		if (!fs.existsSync(entityPath)) {
			// Entity directory doesn't exist, which is fine - no entities to delete
			return;
		}

		const files = fs.readdirSync(entityPath);

		for (const file of files) {
			if (file.startsWith("ENTITY.")) {
				const filePath = path.join(entityPath, file);
				fs.rmSync(filePath);
			}
		}
	}

	public async clearUserData() {
		// Clear all maps (since we don't have user authentication in local storage)
		const mapDir = DIR_MAPPING[StoreType.Map];
		if (fs.existsSync(mapDir)) {
			const directories = fs
				.readdirSync(mapDir, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			for (const dirName of directories) {
				const mapPath = path.join(mapDir, dirName);
				fs.rmSync(mapPath, { recursive: true, force: true });
			}
		}

		// Clear all entities
		const entityDir = DIR_MAPPING[StoreType.Entities];
		if (fs.existsSync(entityDir)) {
			const directories = fs
				.readdirSync(entityDir, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			for (const dirName of directories) {
				const entityPath = path.join(entityDir, dirName);
				fs.rmSync(entityPath, { recursive: true, force: true });
			}
		}
	}

	public async getSettings(): Promise<
		{ keyMap: any; handed: string } | undefined
	> {
		const settingsPath = path.join(
			DIR_MAPPING[StoreType.Settings],
			"settings.data",
		);
		if (!fs.existsSync(settingsPath)) {
			return undefined;
		}
		const data = fs.readFileSync(settingsPath, "utf8");
		return JSON.parse(data) as { keyMap: any; handed: string };
	}

	public async hasSettings(): Promise<boolean> {
		const settingsPath = path.join(
			DIR_MAPPING[StoreType.Settings],
			"settings.data",
		);
		return fs.existsSync(settingsPath);
	}

	public async createSettings(): Promise<void> {
		const settingsPath = path.join(
			DIR_MAPPING[StoreType.Settings],
			"settings.data",
		);
		fs.writeFileSync(
			settingsPath,
			JSON.stringify({ keyMap: defaultKeys, handed: "right" }),
		);
	}

	public async updateSettings(settings: any): Promise<void> {
		const settingsPath = path.join(
			DIR_MAPPING[StoreType.Settings],
			"settings.data",
		);
		fs.writeFileSync(settingsPath, JSON.stringify(settings));
	}

	public async death(tileSetId: string) {
		// Clear entity states FIRST (before any directory deletion)
		await this.clearEntityStates(tileSetId);

		// Clear all blocks for this tileset
		const mapPath = path.join(DIR_MAPPING[StoreType.Map], tileSetId);
		if (fs.existsSync(mapPath)) {
			const files = fs.readdirSync(mapPath);
			for (const file of files) {
				if (file.startsWith("BLK.")) {
					const filePath = path.join(mapPath, file);
					fs.unlinkSync(filePath);
				}
			}
		}

		// Clear all clusters for this tileset
		if (fs.existsSync(mapPath)) {
			const files = fs.readdirSync(mapPath);
			for (const file of files) {
				if (file.startsWith("CLUSTER.")) {
					const filePath = path.join(mapPath, file);
					fs.unlinkSync(filePath);
				}
			}
		}

		// Remove the tileset directory
		if (fs.existsSync(mapPath)) {
			fs.rmSync(mapPath, { recursive: true, force: true });
		}
	}
}
