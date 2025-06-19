import Dexie, { type Table } from 'dexie';
import type { Cluster, Clusters, Tile } from './map';
import type { Entity, Movable } from './entity';
import * as immutable from 'immutable';
import { api } from '../convex/_generated/api';
import type { ConvexClient } from 'convex/browser';

export interface IVec2d {
    x: number;
    y: number;
}

export const Vec2d = immutable.Record<IVec2d>({
    x: 0,
    y: 0
});
export type Vec2d = ReturnType<typeof Vec2d>;

export function updateEntitiesMap(
    currentEntities: immutable.Map<Vec2d, Entity>,
    oldPosition: Vec2d, // Old key
    newPosition: Vec2d, // New key
    entity: Entity // The entity itself (same instance)
): immutable.Map<Vec2d, Entity> {
    if (!oldPosition.equals(newPosition)) {
        return currentEntities
            .delete(oldPosition)
            .set(newPosition, entity);
    }
    // If only other properties changed (e.g., health), just ensure map holds the updated instance
    return currentEntities.set(newPosition, entity);
}

export function removeEntityFromMap(
    currentEntities: immutable.Map<Vec2d, Entity>,
    entityToRemove: Entity & Movable
): immutable.Map<Vec2d, Entity> {
    return currentEntities.delete(entityToRemove.position);
}

export interface State {
    currentCluster: Cluster | null;
    entities: immutable.Map<Vec2d, Entity>;
}

export interface ClustersSchema {
    id?: number;
    clusters_data: string;
}

export interface TilesSchema {
    id?: string;
    tiles_data: string;
    createdAt: string
}

export interface TileChunksSchema {
    id?: number;
    main_id: number;
    chunk_index: number;
    chunk_data: string;
}

function makeBlocks(
    tiles: Tile[][],
    blockSize: number
): Array<{ blockX: number; blockY: number; data: Tile[][] }> {
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
            blocks.push({ blockX: bx, blockY: by, data });
        }
    }
    return blocks;
}
export class DB {
    private readonly CHUNK_SIZE = 1000;

    constructor(private client: ConvexClient) {
    }

    async saveTiles(tiles: Tile[][]): Promise<string> {
        console.log("saving")
        const tileSetId = await this.client.mutation(api.functions.saveTileSet.createTileSet, {
            width: tiles.length,
            height: tiles[0].length
        })
        const allBlocks = makeBlocks(tiles, 40);

        const BATCH = 20;
        for (let i = 0; i < allBlocks.length; i += BATCH) {
            const batch = allBlocks.slice(i, i + BATCH);
            await this.client.mutation(api.functions.saveTileSet.insertTileBlocks, {
                tileSetId,
                blocks: batch,
            });
        }
        return tileSetId
    }

    async importAll(file: File) {
        if (!file || file.type !== 'application/gzip' && !file.name.endsWith('.gz')) {
            console.error('Invalid file type. Please select a .gz file.');
            throw new Error('Invalid file type');
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
                    this.saveTiles(tileSetData)
                }
                for (const clusterData of f_json.clusters) {
                    this.saveClusters(clusterData)
                }

                console.log('Database imported successfully!');
            } else {
                console.error('Imported JSON is missing expected "tile_sets" or "clusters" properties.');
                throw new Error('Invalid imported data structure');
            }

        } catch (error) {
            console.error('Error importing database:', error);
            throw error; // Re-throw to handle higher up
        }
    }

    async clear() {
        await this.client.mutation(api.functions.saveTileSet.clearUserData, {})
    }
    // Helper function for decompression
    private async decompressGzip(compressedBuffer: ArrayBuffer): Promise<ArrayBuffer> {
        const decompressor = new DecompressionStream("gzip");
        const writer = decompressor.writable.getWriter();
        writer.write(compressedBuffer);
        writer.close();
        return await new Response(decompressor.readable).arrayBuffer();
    }

    async saveClusters(
        tileSetId: string,
        clusters: Clusters
    ): Promise<string> {
        return this.client.mutation(api.functions.clusters.saveClusters, {
            tileSetId: tileSetId,
            clusters: clusters,
        });
    }

    async loadClusters(id: string): Promise<Clusters | null> {
        return this.client.query(api.functions.clusters.loadClusters, { tileSetId: id });
    }

    async updateClusters(
        clusterId: string,
        clusters: Clusters
    ): Promise<void> {
        await this.client.mutation(api.functions.clusters.updateClusters, {
            tileSetId: clusterId,
            clusters,
        });
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
        }>
    ): Promise<void> {
        await this.client.mutation(
            api.functions.saveTileSet.updateViewportTiles,
            {
                tileSetId,
                viewport: { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.width },
                blockSize: 40,
                tileUpdates, // [{ x, y, tile }, …]
            }
        );
    }
    async getAllTiles() {
        const tileSets = this.client.query(api.functions.getTileSet.getTileSets, {});
        return tileSets
    }

    async loadTiles(id: string): Promise<Tile[][]> {
        // 1) fetch meta + blocks
        const { meta, blocks } = await this.client.query(
            api.functions.getTileSet.getTileSet,
            { tileSetId: id }
        );
        const { width, height } = meta;

        // 2) allocate 2D array
        const tiles2D: Tile[][] = Array.from({ length: width }, () =>
            Array<Tile>(height)
        );
        const blockSize = 40;

        // 3) stitch blocks back in
        for (const { blockX, blockY, data } of blocks) {
            for (let i = 0; i < data.length; i++) {
                const x = blockX * blockSize + i;
                if (x >= width) continue;
                for (let j = 0; j < data[i].length; j++) {
                    const y = blockY * blockSize + j;
                    if (y >= height) continue;
                    tiles2D[x][y] = data[i][j];
                }
            }
        }
        return tiles2D;
    }
}
