import { decode, encode } from "@msgpack/msgpack";
import { ZstdInit } from "@oneidentity/zstd-js";
import type * as immutable from "immutable";
import { Debug } from "./debug";
import { TileKinds } from "./map";
import { Storage } from "./storage";
import type {
	BlockData,
	Cluster,
	Clusters,
	Entity,
	GameSettings,
	MapGenerationResult,
	Material,
	Movable,
	Tile,
	TileSetParams,
	TileUpdate,
	Vec2d,
	Viewport,
} from "./types";

export { Vec2d } from "./types";

export function updateEntitiesMap(
	currentEntities: immutable.Map<Vec2d, Entity>,
	oldPosition: Vec2d,
	newPosition: Vec2d,
	entity: Entity,
): immutable.Map<Vec2d, Entity> {
	if (!oldPosition.equals(newPosition)) {
		return currentEntities.delete(oldPosition).set(newPosition, entity);
	}

	return currentEntities.set(newPosition, entity);
}

export function removeEntityFromMap(
	currentEntities: immutable.Map<Vec2d, Entity>,
	entityToRemove: Entity & Movable,
): immutable.Map<Vec2d, Entity> {
	return currentEntities.delete(entityToRemove.position);
}

export interface State {
	currentCluster: Cluster | null;
}

async function makeBlocks(
	tiles: Tile[][],
	blockSize: number,
): Promise<BlockData[]> {
	const w = tiles.length;
	const h = tiles[0].length;
	const blocks: BlockData[] = [];
	const blocksX = Math.ceil(w / blockSize);
	const blocksY = Math.ceil(h / blockSize);

	for (let bx = 0; bx < blocksX; bx++) {
		for (let by = 0; by < blocksY; by++) {
			const data: Tile[][] = [];
			for (let i = 0; i < blockSize; i++) {
				const x = bx * blockSize + i;
				if (x >= w) break;
				data[i] = [];
				for (let j = 0; j < blockSize; j++) {
					const y = by * blockSize + j;
					if (y >= h) break;
					data[i][j] = tiles[x][y];
				}
			}

			// Encode and compress with gzip
			const encodedData = encode(data);
			const compressor = new CompressionStream("gzip");
			const writer = compressor.writable.getWriter();
			writer.write(encodedData);
			writer.close();
			const compressedData = await new Response(
				compressor.readable,
			).arrayBuffer();

			blocks.push({
				blockX: bx,
				blockY: by,
				data: compressedData,
			});
		}
	}
	return blocks;
}

export class DB {
	private readonly CHUNK_SIZE = 1000;
	public static _instance: DB;
	public dead: boolean = false;

	constructor(_: any) {
		if (DB._instance) {
			return;
		}
		DB._instance = this;
	}

	async saveTileHeader(width: number, height: number, name: string) {
		return Storage.instance.createTileSet({
			width,
			height,
			name,
		} as TileSetParams);
	}

	async saveTiles(tileSetId: string, tiles: Tile[][]): Promise<string> {
		Debug.getInstance().info("saving");
		// Process tiles into blocks
		const allBlocks = await makeBlocks(tiles, 64); // Optimized for database records

		// TODO: Implement batch saving of blocks to your database
		const BATCH = 20;
		for (let i = 0; i < allBlocks.length; i += BATCH) {
			const batch = allBlocks.slice(i, i + BATCH);
			Debug.getInstance().info("saving batch", batch);
			Storage.instance.insertTileBlocks(tileSetId, batch);
		}
		return tileSetId;
	}

	async importAll(file: File) {
		if (
			!file ||
			(file.type !== "application/gzip" && !file.name.endsWith(".gz"))
		) {
			Debug.getInstance().error("Invalid file type. Please select a .gz file.");
			throw new Error("Invalid file type");
		}

		try {
			const compressedBuffer = await file.arrayBuffer();

			const decompressedBuffer = await this.decompressGzip(compressedBuffer);

			const decodedString = new TextDecoder().decode(decompressedBuffer);

			const f_json = JSON.parse(decodedString);

			if (f_json.tile_sets && f_json.clusters) {
				const loadedTileSets = f_json.tile_sets;
				const loadedClusters = f_json.clusters;
				for (const tileSetData of f_json.tile_sets) {
					await this.saveTiles(tileSetData.id, tileSetData.tiles);
				}
				for (const clusterData of f_json.clusters) {
					await this.saveClusters(clusterData.tileSetId, clusterData.clusters);
				}

				Debug.getInstance().info("Database imported successfully!");
			} else {
				Debug.getInstance().error(
					'Imported JSON is missing expected "tile_sets" or "clusters" properties.',
				);
				throw new Error("Invalid imported data structure");
			}
		} catch (error) {
			Debug.getInstance().error(`Error importing database: ${error}`);
			throw error; // Re-throw to handle higher up
		}
	}

	// Helper function for compression
	private async compressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
		const compressor = new CompressionStream("gzip");
		const writer = compressor.writable.getWriter();
		writer.write(data);
		writer.close();
		return await new Response(compressor.readable).arrayBuffer();
	}

	// Helper function for decompression
	private async decompressGzip(
		compressedBuffer: ArrayBuffer,
	): Promise<ArrayBuffer> {
		const decompressor = new DecompressionStream("gzip");
		const writer = decompressor.writable.getWriter();
		writer.write(compressedBuffer);
		writer.close();
		return await new Response(decompressor.readable).arrayBuffer();
	}

	private async tryDecompressBlock(
		data: ArrayBuffer,
		zstd: any,
	): Promise<any | null> {
		// Try gzip decompression first (new format)
		try {
			const decompressedData = await this.decompressGzip(data);
			return decode(new Uint8Array(decompressedData));
		} catch {
			Debug.getInstance().error("Failed to decompress block");
			return null;
		}
	}

	async saveClusters(tileSetId: string, clusters: Clusters): Promise<string> {
		try {
			await Storage.instance.saveClusters(tileSetId, clusters);
			Debug.getInstance().info("Clusters saved successfully");
			return tileSetId;
		} catch (error) {
			Debug.getInstance().error(`Failed to save clusters: ${error}`);
			return tileSetId;
		}
	}

	async loadClusters(id: string): Promise<Clusters | null> {
		try {
			const clusters = await Storage.instance.loadCluster(id);

			// SuperJSON handles Vec2d serialization automatically, so we can return the clusters directly
			return clusters;
		} catch (error) {
			Debug.getInstance().error(`Failed to load clusters: ${error}`);
			// Return empty clusters object instead of null
			const emptyClusters: Clusters = {
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
			return emptyClusters;
		}
	}

	async updateClusters(clusterId: string, clusters: Clusters): Promise<void> {
		// TODO: Implement updateClusters - update existing clusters
		await Storage.instance.clusterUpdate(clusterId, clusters);
	}

	async saveMaterials(tileSetId: string, materials: Material[]): Promise<void> {
		const encodedMaterials = encode(materials);
		const compressedMaterials = await this.compressGzip(encodedMaterials);
		// TODO: Implement saveMaterials - store compressed materials
	}

	async loadMaterials(tileSetId: string): Promise<Material[]> {
		// TODO: Implement loadMaterials - retrieve and decompress materials
		const materials = null; // TODO: Get from your database
		if (materials) {
			const decompressedMaterials = await this.decompressGzip(materials);
			return decode(decompressedMaterials) as Material[];
		}
		return [];
	}

	async updateViewportTiles(
		tileSetId: string,
		viewport: Viewport,
		tileUpdates: TileUpdate[],
	): Promise<void> {
		// Group updates by block and prepare compressed blocks
		const blockSize = 64; // Optimized for database records (36 vs 81 records)
		const blockUpdates = new Map<
			string,
			Array<{ localX: number; localY: number; tile: Tile }>
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
		const zstd = await ZstdInit();
		const compressedBlocks: Array<{
			blockX: number;
			blockY: number;
			data: ArrayBuffer;
		}> = [];

		// Load existing blocks from storage
		const { blocks } = await Storage.instance.loadMapContent(tileSetId);

		for (const [key, updates] of blockUpdates) {
			const [bx, by] = key.split(",").map(Number);

			try {
				// Find the specific block we need
				const block = blocks.find((b) => b.blockX === bx && b.blockY === by);
				let blockData: Tile[][];

				if (!block) {
					// Block doesn't exist, create a new empty block
					blockData = Array.from({ length: blockSize }, () =>
						Array.from(
							{ length: blockSize },
							() =>
								({
									char: " ",
									kind: 0,
									boundary: false,
									mask: null,
								}) as Tile,
						),
					);
				} else {
					// Check if data is valid
					if (!block.data || block.data.byteLength === 0) {
						Debug.getInstance().error(
							`Block (${bx},${by}) has empty data, creating new empty block`,
						);
						blockData = Array.from({ length: blockSize }, () =>
							Array.from(
								{ length: blockSize },
								() =>
									({
										char: " ",
										kind: 0,
										boundary: false,
										mask: null,
									}) as Tile,
							),
						);
					} else {
						// Try to decompress and decode the existing block
						try {
							// Try gzip decompression first (new format)
							const decompressedData = await this.decompressGzip(block.data);
							blockData = decode(new Uint8Array(decompressedData)) as Tile[][];
						} catch (decompressError) {
							Debug.getInstance().error(
								`Failed to decompress block (${bx},${by}) with gzip: ${decompressError}`,
							);

							// Fallback: try legacy ZSTD format
							try {
								const dataBytes = new Uint8Array(block.data);
								const decompressedData = zstd.ZstdSimple.decompress(dataBytes);
								blockData = decode(decompressedData) as Tile[][];
							} catch (zstdError) {
								Debug.getInstance().error(
									`Failed to decompress block (${bx},${by}) with ZSTD: ${zstdError}`,
								);

								// Final fallback: try as plain JSON
								try {
									blockData = JSON.parse(new TextDecoder().decode(block.data));
								} catch (jsonError) {
									Debug.getInstance().error(
										`Failed to parse block (${bx},${by}) as JSON: ${jsonError}`,
									);
									// Create new empty block if all decompression methods fail
									blockData = Array.from({ length: blockSize }, () =>
										Array.from(
											{ length: blockSize },
											() =>
												({
													char: " ",
													kind: 0,
													boundary: false,
													mask: null,
												}) as Tile,
										),
									);
								}
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

				// Re-compress the updated block
				const encodedData = encode(blockData);

				// Compress using native browser gzip
				const finalData = await this.compressGzip(encodedData);

				Debug.getInstance().info(
					`Block (${bx},${by}) gzip compression: ${encodedData.byteLength} -> ${finalData.byteLength} bytes`,
				);

				compressedBlocks.push({
					blockX: bx,
					blockY: by,
					data: finalData,
				});

				Debug.getInstance().info(
					`Block (${bx},${by}) re-compressed successfully`,
				);
			} catch (blockError) {
				Debug.getInstance().error(
					`Error processing block (${bx},${by}) for updates: ${blockError}`,
				);
				// Re-throw the error to fail the entire update operation
				throw new Error(`Failed to process block (${bx},${by}): ${blockError}`);
			}
		}

		// Validate that we have blocks to update
		if (compressedBlocks.length === 0) {
			Debug.getInstance().warn(
				"No blocks to update - all updates may have been filtered out",
			);
			return;
		}

		Storage.instance.insertTileBlocks(tileSetId, compressedBlocks);
		// TODO: Send the pre-compressed blocks to your database
	}

	async getAllTiles() {
		// TODO: Implement getAllTiles - get all tile sets from your database
		return Storage.instance.getAllMaps();
	}

	async loadTiles(id: string): Promise<Tile[][]> {
		try {
			const { blocks, meta } = await Storage.instance.loadMapContent(id);
			const { width, height } = meta;

			// Validate meta data
			if (
				!width ||
				!height ||
				typeof width !== "number" ||
				typeof height !== "number"
			) {
				throw new Error(
					`Invalid map dimensions: width=${width}, height=${height}`,
				);
			}

			// 2) allocate 2D array
			const tiles2D: Tile[][] = Array.from({ length: width }, () =>
				Array<Tile>(height),
			);
			const blockSize = 64; // Optimized for database records (36 vs 81 records)
			const zstd = await ZstdInit();

			// 3) stitch blocks back in
			for (const { blockX, blockY, data } of blocks) {
				// Check if data is valid
				if (!data || data.byteLength === 0) {
					continue;
				}

				// Try to decompress and decode the block
				const decodedData = await this.tryDecompressBlock(data, zstd);
				if (!decodedData) {
					continue; // Skip this block
				}

				// Copy decoded data to tiles array
				for (let i = 0; i < decodedData.length; i++) {
					const x = blockX * blockSize + i;
					if (x >= width) continue;
					for (let j = 0; j < decodedData[i].length; j++) {
						const y = blockY * blockSize + j;
						if (y >= height) continue;
						tiles2D[x][y] = decodedData[i][j];
					}
				}
			}
			return tiles2D;
		} catch (error) {
			throw error;
		}
	}

	async death(tileSetId: any): Promise<void> {
		this.dead = true;
		await Storage.instance.death(tileSetId);
	}

	async canMakeMap(): Promise<MapGenerationResult> {
		return { state: true, message: "stub" };
	}

	async getEntityState(
		tileSetId: any,
		entityId: string,
	): Promise<string | null> {
		return Storage.instance.getEntityState(tileSetId, entityId);
	}

	async saveEntityState(
		tileSetId: any,
		entityId: string,
		state: string,
	): Promise<void> {
		await Storage.instance.saveEntityState(tileSetId, entityId, state);
	}

	async getSettings(): Promise<GameSettings | undefined> {
		return Storage.instance.getSettings();
	}

	async hasSettings(): Promise<boolean> {
		return Storage.instance.hasSettings();
	}

	async createSettings(): Promise<void> {
		await Storage.instance.createSettings();
	}

	async updateSettings(settings: any): Promise<void> {
		await Storage.instance.updateSettings(settings);
	}
}
