import { decode, encode } from "@msgpack/msgpack";
import { ZstdInit } from "@oneidentity/zstd-js";
import type { ConvexClient } from "convex/browser";
import * as immutable from "immutable";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Debug } from "./debug";
import type { Material } from "./generators/material_gen";
import type { Cluster, Clusters, Tile } from "./map";
import type { Entity, Movable } from "./traits";

export interface IVec2d {
	x: number;
	y: number;
}

export const Vec2d = immutable.Record<IVec2d>({
	x: 0,
	y: 0,
});
export type Vec2d = ReturnType<typeof Vec2d>;

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

export interface ClustersSchema {
	id?: number;
	clusters_data: string;
}

export interface TilesSchema {
	id?: string;
	tiles_data: string;
	createdAt: string;
}

export interface TileChunksSchema {
	id?: number;
	main_id: number;
	chunk_index: number;
	chunk_data: string;
}

async function makeBlocks(
	tiles: Tile[][],
	blockSize: number,
): Promise<Array<{ blockX: number; blockY: number; data: ArrayBuffer }>> {
	const w = tiles.length;
	const h = tiles[0].length;
	const blocks = [];
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

	constructor(private client: ConvexClient) {
		if (DB._instance) {
			return;
		}
		DB._instance = this;
	}

	async saveTileHeader(width: number, height: number) {
		return await this.client.mutation(api.functions.saveTileSet.createTileSet, {
			width,
			height,
		});
	}
	async saveTiles(tileSetId: string, tiles: Tile[][]): Promise<string> {
		Debug.getInstance().info("saving");
		// const tileSetId = await this.client.mutation(api.functions.saveTileSet.createTileSet, {
		//     width: tiles.length,
		//     height: tiles[0].length
		// })
		const allBlocks = await makeBlocks(tiles, 64); // Optimized for database records

		const BATCH = 20;
		for (let i = 0; i < allBlocks.length; i += BATCH) {
			const batch = allBlocks.slice(i, i + BATCH);
			Debug.getInstance().info("saving batch", batch);
			await this.client.mutation(api.functions.saveTileSet.insertTileBlocks, {
				tileSetId: tileSetId as Id<"tileSets">,
				blocks: batch,
			});
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
					this.saveTiles(tileSetData.id, tileSetData.tiles);
				}
				for (const clusterData of f_json.clusters) {
					this.saveClusters(clusterData.tileSetId, clusterData.clusters);
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

	async clear() {
		await this.client.mutation(api.functions.saveTileSet.clearUserData, {});
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

	async saveClusters(tileSetId: string, clusters: Clusters): Promise<string> {
		return this.client.mutation(api.functions.clusters.saveClusters, {
			tileSetId: tileSetId,
			clusters: clusters,
		});
	}

	async loadClusters(id: string): Promise<Clusters | null> {
		return this.client.query(api.functions.clusters.loadClusters, {
			tileSetId: id,
		});
	}

	async updateClusters(clusterId: string, clusters: Clusters): Promise<void> {
		await this.client.mutation(api.functions.clusters.updateClusters, {
			tileSetId: clusterId,
			clusters,
		});
	}

	async saveMaterials(tileSetId: string, materials: Material[]): Promise<void> {
		const encodedMaterials = encode(materials);
		const compressedMaterials = await this.compressGzip(encodedMaterials);
		await this.client.mutation(api.functions.materials.saveMaterials, {
			tileSetId: tileSetId as Id<"tileSets">,
			materials: compressedMaterials,
		});
	}

	async loadMaterials(tileSetId: string): Promise<Material[]> {
		const materials = await this.client.query(
			api.functions.materials.loadMaterials,
			{
				tileSetId: tileSetId as Id<"tileSets">,
			},
		);
		const decompressedMaterials = await this.decompressGzip(materials);
		return decode(decompressedMaterials) as Material[];
	}

	async updateViewportTiles(
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
			tile: Tile;
		}>,
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

		// Get all blocks for this tileSet to avoid multiple queries
		const { blocks } = await this.client.query(
			api.functions.getTileSet.getTileSet,
			{ tileSetId },
		);

		for (const [key, updates] of blockUpdates) {
			const [bx, by] = key.split(",").map(Number);

			try {
				// Find the specific block we need
				const block = blocks.find((b) => b.blockX === bx && b.blockY === by);
				if (!block) {
					throw new Error(`Block (${bx},${by}) not found`);
				}

				Debug.getInstance().info(
					`Processing block (${bx},${by}) for updates, data size: ${block.data.byteLength}`,
				);

				// Check if data is valid
				if (!block.data || block.data.byteLength === 0) {
					Debug.getInstance().error(
						`Block (${bx},${by}) has empty data, skipping`,
					);
					continue;
				}

				// Try to decompress and decode the existing block
				let blockData: Tile[][];
				try {
					Debug.getInstance().info(
						`Block (${bx},${by}) data type: ${typeof block.data}, byteLength: ${block.data.byteLength}`,
					);

					// Try gzip decompression first (new format)
					Debug.getInstance().info(
						`Block (${bx},${by}) attempting gzip decompression`,
					);
					const decompressedData = await this.decompressGzip(block.data);
					blockData = decode(new Uint8Array(decompressedData)) as Tile[][];

					Debug.getInstance().info(
						`Block (${bx},${by}) gzip decompression successful`,
					);
				} catch (decompressError) {
					Debug.getInstance().error(
						`Failed to decompress block (${bx},${by}) with gzip: ${decompressError}`,
					);

					// Fallback: try legacy ZSTD format
					try {
						const dataBytes = new Uint8Array(block.data);
						Debug.getInstance().info(
							`Block (${bx},${by}) trying legacy ZSTD decompression`,
						);
						const decompressedData = zstd.ZstdSimple.decompress(dataBytes);
						blockData = decode(decompressedData) as Tile[][];
						Debug.getInstance().info(
							`Block (${bx},${by}) legacy ZSTD decompression successful`,
						);
					} catch (zstdError) {
						Debug.getInstance().error(
							`Failed to decompress block (${bx},${by}) with ZSTD: ${zstdError}`,
						);

						// Final fallback: try as plain JSON
						try {
							blockData = JSON.parse(new TextDecoder().decode(block.data));
							Debug.getInstance().info(
								`Block (${bx},${by}) loaded as legacy JSON`,
							);
						} catch (jsonError) {
							Debug.getInstance().error(
								`Failed to parse block (${bx},${by}) as JSON: ${jsonError}`,
							);
							throw new Error(
								`Block (${bx},${by}) data is corrupted or in unknown format`,
							);
						}
					}
				}

				Debug.getInstance().info(
					`Block (${bx},${by}) decompressed successfully, applying ${updates.length} updates`,
				);

				// Apply all updates for this block
				for (const { localX, localY, tile } of updates) {
					if (blockData[localX] && blockData[localX][localY] !== undefined) {
						blockData[localX][localY] = tile;
					}
				}

				// Re-compress the updated block
				const encodedData = encode(blockData);
				Debug.getInstance().info(
					`Block (${bx},${by}) encoded data size: ${encodedData.byteLength}`,
				);

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

		Debug.getInstance().info(
			`Sending ${compressedBlocks.length} compressed blocks to server`,
		);

		// Send the pre-compressed blocks to the server
		await this.client.mutation(api.functions.saveTileSet.updateViewportTiles, {
			tileSetId: tileSetId as Id<"tileSets">,
			blockUpdates: compressedBlocks,
		});
	}
	async getAllTiles() {
		const tileSets = this.client.query(
			api.functions.getTileSet.getTileSets,
			{},
		);
		return tileSets;
	}

	async loadTiles(id: string): Promise<Tile[][]> {
		try {
			// 1) fetch meta + blocks
			const { meta, blocks } = await this.client.query(
				api.functions.getTileSet.getTileSet,
				{ tileSetId: id },
			);
			const { width, height } = meta;

			Debug.getInstance().info(
				`Loading tiles: ${width}x${height}, ${blocks.length} blocks`,
			);

			// 2) allocate 2D array
			const tiles2D: Tile[][] = Array.from({ length: width }, () =>
				Array<Tile>(height),
			);
			const blockSize = 64; // Optimized for database records (36 vs 81 records)
			const zstd = await ZstdInit();

			// 3) stitch blocks back in
			for (const { blockX, blockY, data } of blocks) {
				try {
					Debug.getInstance().info(
						`Processing block (${blockX},${blockY}), data size: ${data.byteLength}`,
					);

					// Check if data is valid
					if (!data || data.byteLength === 0) {
						Debug.getInstance().error(
							`Block (${blockX},${blockY}) has empty data`,
						);
						continue;
					}

					// Try to decompress and decode the block
					let decodedData: any;
					try {
						// Try gzip decompression first (new format)
						const decompressedData = await this.decompressGzip(data);
						decodedData = decode(new Uint8Array(decompressedData));
						Debug.getInstance().info(
							`Block (${blockX},${blockY}) gzip decompression successful`,
						);
					} catch (gzipError) {
						Debug.getInstance().info(
							`Block (${blockX},${blockY}) gzip failed, trying ZSTD: ${gzipError}`,
						);
						try {
							// Fallback to ZSTD (legacy format)
							const decompressedData = zstd.ZstdSimple.decompress(
								new Uint8Array(data),
							);
							decodedData = decode(decompressedData);
							Debug.getInstance().info(
								`Block (${blockX},${blockY}) ZSTD decompression successful`,
							);
						} catch (zstdError) {
							Debug.getInstance().error(
								`Failed to decompress block (${blockX},${blockY}) with ZSTD: ${zstdError}`,
							);
							// Final fallback: try as plain JSON
							try {
								decodedData = JSON.parse(new TextDecoder().decode(data));
								Debug.getInstance().info(
									`Block (${blockX},${blockY}) loaded as plain JSON`,
								);
							} catch (jsonError) {
								Debug.getInstance().error(
									`Failed to parse block (${blockX},${blockY}) as JSON: ${jsonError}`,
								);
								continue; // Skip this block
							}
						}
					}

					Debug.getInstance().info(
						`Block (${blockX},${blockY}) decompressed successfully, size: ${decodedData.length}x${decodedData[0]?.length || 0}`,
					);

					for (let i = 0; i < decodedData.length; i++) {
						const x = blockX * blockSize + i;
						if (x >= width) continue;
						for (let j = 0; j < decodedData[i].length; j++) {
							const y = blockY * blockSize + j;
							if (y >= height) continue;
							tiles2D[x][y] = decodedData[i][j];
						}
					}
				} catch (blockError) {
					Debug.getInstance().error(
						`Error processing block (${blockX},${blockY}): ${blockError}`,
					);
				}
			}
			return tiles2D;
		} catch (error) {
			Debug.getInstance().error(`Error in loadTiles: ${error}`);
			throw error;
		}
	}

	async death(tileSetId: Id<"tileSets">): Promise<void> {
		await this.client.mutation(api.functions.saveTileSet.death, {
			tileSetId,
		});
	}

	async canMakeMap(): Promise<{ state: boolean; message: string }> {
		return await this.client.query(api.functions.saveTileSet.canMakeMap, {});
	}

	async getEntityState(
		tileSetId: Id<"tileSets">,
		entityId: string,
	): Promise<string | null> {
		return await this.client.query(api.functions.entityStates.getEntityState, {
			tileSetId,
			entityId,
		});
	}

	async saveEntityState(
		tileSetId: Id<"tileSets">,
		entityId: string,
		state: string,
	): Promise<void> {
		await this.client.mutation(api.functions.entityStates.saveEntityState, {
			tileSetId,
			entityId,
			state,
		});
	}

	async getSettings(): Promise<{ keyMap: any; handed: string } | undefined> {
		const result = await this.client.query(
			api.functions.settings.getSettings,
			{},
		);
		if (result === null) return undefined;
		return result;
	}

	async hasSettings(): Promise<boolean> {
		return await this.client.query(api.functions.settings.hasSettings, {});
	}

	async createSettings(): Promise<void> {
		await this.client.mutation(api.functions.settings.createSettings, {});
	}

	async updateSettings(settings: any): Promise<void> {
		await this.client.mutation(api.functions.settings.updateSettings, settings);
	}
}
