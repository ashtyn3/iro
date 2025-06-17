import Dexie, { type Table } from 'dexie';
import type { Cluster, Clusters, Tile } from './map';
import type { Inventory } from './inventory';
import type { Entity, Movable } from './entity';
import * as immutable from 'immutable';
import { Engine } from '$lib/index';

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
    id?: number;
    tiles_data: string;
    created: Date
}

export interface TileChunksSchema {
    id?: number;
    main_id: number;
    chunk_index: number;
    chunk_data: string;
}

export class IroDB extends Dexie {
    tiles!: Table<TilesSchema>;
    tile_chunks!: Table<TileChunksSchema>;
    clusters!: Table<ClustersSchema>;

    constructor() {
        super('IroDB');

        // Version 1 - original schema
        this.version(1).stores({
            tiles: '++id, created, tiles_data',
            tile_chunks: '++id, main_id, chunk_index, chunk_data',
            clusters: '++id, clusters_data'
        });

        // Version 2 - with compound index
        this.version(2).stores({
            tiles: '++id, created, tiles_data',
            tile_chunks: '++id, main_id, chunk_index, [main_id+chunk_index], chunk_data',
            clusters: '++id, clusters_data'
        });
    }
}

export class DB {
    private db: IroDB;
    private readonly CHUNK_SIZE = 1000; // Adjust based on your needs

    constructor() {
        this.db = new IroDB();
    }

    async saveTiles(tiles: Tile[][]): Promise<number> {
        const width = tiles.length;
        const height = tiles[0]?.length || 0;

        // Flatten the 2D array
        const flattened = tiles.flat();

        // Create main record
        const mainId = await this.db.tiles.add({
            created: new Date(),
            tiles_data: JSON.stringify({
                width,
                height,
                total_tiles: flattened.length,
                chunked: true,
            }),
        });

        // Save in smaller chunks
        const chunkPromises = [];
        for (let i = 0; i < flattened.length; i += this.CHUNK_SIZE) {
            const chunk = flattened.slice(i, i + this.CHUNK_SIZE);
            const chunkIndex = Math.floor(i / this.CHUNK_SIZE);

            chunkPromises.push(
                this.db.tile_chunks.add({
                    main_id: mainId,
                    chunk_index: chunkIndex,
                    chunk_data: JSON.stringify(chunk),
                })
            );
        }

        await Promise.all(chunkPromises);

        console.log('wrote tiles at:', mainId);
        return mainId;
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
                const loadedTileSets = f_json.tile_sets; // Example: if you cache loaded sets
                const loadedClusters = f_json.clusters; // Example: if you cache loaded clusters
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

    // Helper function for decompression
    private async decompressGzip(compressedBuffer: ArrayBuffer): Promise<ArrayBuffer> {
        const decompressor = new DecompressionStream("gzip");
        const writer = decompressor.writable.getWriter();
        writer.write(compressedBuffer);
        writer.close();
        return await new Response(decompressor.readable).arrayBuffer();
    }

    async saveClusters(clusters: Clusters): Promise<number> {
        try {
            const id = await this.db.clusters.add({
                clusters_data: JSON.stringify(clusters),
            });
            return id;
        } catch (error) {
            console.error('Error saving clusters:', error);
            throw error;
        }
    }

    async loadClusters(id: number): Promise<Clusters | null> {
        try {
            const record = await this.db.clusters.get(id);

            if (!record) {
                console.log('No clusters found with id:', id);
                return null;
            }

            return JSON.parse(record.clusters_data);
        } catch (error) {
            console.error('Error loading clusters:', error);
            return null;
        }
    }

    async loadTiles(id: number): Promise<Tile[][]> {
        // Get metadata
        const root = await this.db.tiles.get(id);
        if (!root) {
            throw new Error(`No tiles found with id: ${id}`);
        }

        const { width, height } = JSON.parse(root.tiles_data);

        // Get all chunks
        const chunks = await this.db.tile_chunks
            .where('main_id')
            .equals(id)
            .sortBy("chunk_index");

        const flattened: Tile[] = [];
        for (const chunk of chunks) {
            const chunkData = JSON.parse(chunk.chunk_data);
            flattened.push(...chunkData);
        }

        const result: Tile[][] = [];
        for (let i = 0; i < width; i++) {
            result[i] = flattened.slice(i * height, (i + 1) * height);
        }

        return result;
    }

    // Helper methods for additional functionality
    async getAllClusters(): Promise<ClustersSchema[]> {
        return await this.db.clusters.toArray();
    }

    async getAllTiles(): Promise<TilesSchema[]> {
        return await this.db.tiles.toArray();
    }

    async deleteClusters(id: number): Promise<void> {
        await this.db.clusters.delete(id);
    }

    async deleteTiles(id: number): Promise<void> {
        // Delete main record and all associated chunks
        await this.db.transaction('rw', [this.db.tiles, this.db.tile_chunks], async () => {
            await this.db.tiles.delete(id);
            await this.db.tile_chunks.where('main_id').equals(id).delete();
        });
    }
    async exportAll() {
        const tiles = await this.getAllTiles()
        const f_json = { tile_sets: [], clusters: [] }
        for (const i in tiles) {
            const tile = tiles[i]
            const data = await this.loadTiles(tile.id as number)
            const cl_data = await this.loadClusters(tile.id as number)
            f_json.tile_sets.push(data)
            f_json.clusters.push(cl_data)
        }
        const compressor = new CompressionStream("gzip")
        const writer = compressor.writable.getWriter()
        const encoded = new TextEncoder().encode(JSON.stringify(f_json))
        writer.write(encoded)
        writer.close()
        const compressed = await new Response(compressor.readable).arrayBuffer()
        const blob = new Blob([compressed], { type: 'application/gzip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'database-backup.gz';
        a.click();
        URL.revokeObjectURL(url);
    }

    async clearAll(): Promise<void> {
        await this.db.transaction('rw', [this.db.clusters, this.db.tiles, this.db.tile_chunks], async () => {
            await this.db.clusters.clear();
            await this.db.tiles.clear();
            await this.db.tile_chunks.clear();
        });
    }

    async updateClusters(id: number, clusters: Clusters): Promise<void> {
        try {
            // Use .update() to modify the record with the matching primary key (id).
            // This is far more efficient and correct than adding new records.
            const count = await this.db.clusters.update(id, {
                clusters_data: JSON.stringify(clusters),
            });

            if (count === 0) {
                // If no record was updated (e.g., it was deleted), add it back.
                console.warn(`No cluster record found for id ${id}. Creating a new one.`);
                await this.db.clusters.add({
                    id: id, // Explicitly set the ID to match the tileset
                    clusters_data: JSON.stringify(clusters)
                });
            }
        } catch (error) {
            console.error('Error updating clusters:', error);
            throw error;
        }
    }

    async updateTileChunk(
        mainId: number,
        chunkIndex: number,
        newChunkData: Tile[]
    ): Promise<void> {
        const chunk = await this.db.tile_chunks
            .where(["main_id", "chunk_index"])
            .equals([mainId, chunkIndex])
            .first();

        if (!chunk) {
            throw new Error(
                `No chunk found with main_id: ${mainId}, chunk_index: ${chunkIndex}`
            );
        }

        await this.db.tile_chunks.update(chunk.id!, {
            chunk_data: JSON.stringify(newChunkData),
        });
    }
    async updateVisibleTiles(
        id: number,
        viewport: {
            x: number;
            y: number;
            width: number;
            height: number;
        },
        newTiles: Tile[][]
    ): Promise<void> {
        const root = await this.db.tiles.get(id);
        if (!root) {
            throw new Error(`No tiles found with id: ${id}`);
        }

        const metadata = JSON.parse(root.tiles_data);
        const { width: totalWidth, height: totalHeight } = metadata;

        // Validate viewport bounds
        if (
            viewport.x < 0 ||
            viewport.y < 0 ||
            viewport.x + viewport.width > totalWidth ||
            viewport.y + viewport.height > totalHeight
        ) {
            throw new Error("Viewport bounds exceed tile dimensions");
        }

        // Validate new tiles dimensions
        if (
            newTiles.length !== viewport.width ||
            newTiles.some(row => row.length !== viewport.height)
        ) {
            throw new Error("New tiles dimensions don't match viewport size");
        }

        // Calculate which chunks contain viewport tiles
        const affectedChunks = new Map<number, {
            id: any;
            data: Tile[];
            modified: boolean;
        }>();

        // Process each tile in the viewport
        for (let viewportX = 0; viewportX < viewport.width; viewportX++) {
            for (let viewportY = 0; viewportY < viewport.height; viewportY++) {
                const actualX = viewport.x + viewportX;
                const actualY = viewport.y + viewportY;

                // Convert 2D coordinates to flat index
                const flatIndex = actualX * totalHeight + actualY;
                const chunkIndex = Math.floor(flatIndex / this.CHUNK_SIZE);
                const positionInChunk = flatIndex % this.CHUNK_SIZE;

                // Lazy load chunk data if not already loaded
                if (!affectedChunks.has(chunkIndex)) {
                    const chunk = await this.db.tile_chunks
                        .where(["main_id", "chunk_index"])
                        .equals([id, chunkIndex])
                        .first();

                    if (chunk) {
                        affectedChunks.set(chunkIndex, {
                            id: chunk.id,
                            data: JSON.parse(chunk.chunk_data),
                            modified: false
                        });
                    } else {
                        throw new Error(`Chunk ${chunkIndex} not found`);
                    }
                }

                // Update the specific tile
                const chunkInfo = affectedChunks.get(chunkIndex)!;
                chunkInfo.data[positionInChunk] = newTiles[viewportX][viewportY];
                chunkInfo.modified = true;
            }
        }

        // Save only the modified chunks
        const updatePromises = [];
        for (const chunkInfo of affectedChunks.values()) {
            if (chunkInfo.modified) {
                updatePromises.push(
                    this.db.tile_chunks.update(chunkInfo.id, {
                        chunk_data: JSON.stringify(chunkInfo.data),
                    })
                );
            }
        }

        await Promise.all(updatePromises);
        console.log(`Updated ${updatePromises.length} chunks for viewport at (${viewport.x}, ${viewport.y})`);
    }

    // Update only specific tiles within the viewport
    async updateViewportTiles(
        id: number,
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
        const root = await this.db.tiles.get(id);
        if (!root) {
            throw new Error(`No tiles found with id: ${id}`);
        }

        const metadata = JSON.parse(root.tiles_data);
        const { width: totalWidth, height: totalHeight } = metadata;

        const affectedChunks = new Map<number, {
            id: any;
            data: Tile[];
            modified: boolean;
        }>();

        // Process each tile update
        for (const update of tileUpdates) {
            // Validate relative position
            if (
                update.x < 0 ||
                update.y < 0 ||
                update.x >= viewport.width ||
                update.y >= viewport.height
            ) {
                throw new Error(`Tile update position (${update.x}, ${update.y}) is outside viewport`);
            }

            const actualX = viewport.x + update.x;
            const actualY = viewport.y + update.y;

            // Validate actual position
            if (actualX >= totalWidth || actualY >= totalHeight) {
                throw new Error(`Tile position (${actualX}, ${actualY}) exceeds grid bounds`);
            }

            const flatIndex = actualX * totalHeight + actualY;
            const chunkIndex = Math.floor(flatIndex / this.CHUNK_SIZE);
            const positionInChunk = flatIndex % this.CHUNK_SIZE;

            // Lazy load chunk data
            if (!affectedChunks.has(chunkIndex)) {
                const chunk = await this.db.tile_chunks
                    .where(["main_id", "chunk_index"])
                    .equals([id, chunkIndex])
                    .first();

                if (chunk) {
                    affectedChunks.set(chunkIndex, {
                        id: chunk.id,
                        data: JSON.parse(chunk.chunk_data),
                        modified: false
                    });
                } else {
                    throw new Error(`Chunk ${chunkIndex} not found`);
                }
            }

            // Update the specific tile
            const chunkInfo = affectedChunks.get(chunkIndex)!;
            chunkInfo.data[positionInChunk] = update.tile;
            chunkInfo.modified = true;
        }

        // Save only the modified chunks
        const updatePromises = [];
        for (const chunkInfo of affectedChunks.values()) {
            if (chunkInfo.modified) {
                updatePromises.push(
                    this.db.tile_chunks.update(chunkInfo.id, {
                        chunk_data: JSON.stringify(chunkInfo.data),
                    })
                );
            }
        }

        await Promise.all(updatePromises);
        console.log(`Updated ${tileUpdates.length} tiles in ${updatePromises.length} chunks`);
    }

    // Get current viewport tiles (for display)
    async getViewportTiles(
        id: number,
        viewport: {
            x: number;
            y: number;
            width: number;
            height: number;
        }
    ): Promise<Tile[][]> {
        const root = await this.db.tiles.get(id);
        if (!root) {
            throw new Error(`No tiles found with id: ${id}`);
        }

        const metadata = JSON.parse(root.tiles_data);
        const { width: totalWidth, height: totalHeight } = metadata;

        // Validate viewport bounds
        if (
            viewport.x < 0 ||
            viewport.y < 0 ||
            viewport.x + viewport.width > totalWidth ||
            viewport.y + viewport.height > totalHeight
        ) {
            throw new Error("Viewport bounds exceed tile dimensions");
        }

        const result: Tile[][] = Array(viewport.width)
            .fill(null)
            .map(() => Array(viewport.height));

        // Calculate affected chunks
        const chunkIndices = new Set<number>();
        for (let x = viewport.x; x < viewport.x + viewport.width; x++) {
            for (let y = viewport.y; y < viewport.y + viewport.height; y++) {
                const flatIndex = x * totalHeight + y;
                chunkIndices.add(Math.floor(flatIndex / this.CHUNK_SIZE));
            }
        }

        // Load all needed chunks
        const chunks = await this.db.tile_chunks
            .where("main_id")
            .equals(id)
            .and(chunk => chunkIndices.has(chunk.chunk_index))
            .toArray();

        const chunkMap = new Map();
        chunks.forEach(chunk => {
            chunkMap.set(chunk.chunk_index, JSON.parse(chunk.chunk_data));
        });

        // Extract viewport tiles
        for (let viewportX = 0; viewportX < viewport.width; viewportX++) {
            for (let viewportY = 0; viewportY < viewport.height; viewportY++) {
                const actualX = viewport.x + viewportX;
                const actualY = viewport.y + viewportY;
                const flatIndex = actualX * totalHeight + actualY;
                const chunkIndex = Math.floor(flatIndex / this.CHUNK_SIZE);
                const positionInChunk = flatIndex % this.CHUNK_SIZE;

                const chunkData = chunkMap.get(chunkIndex);
                if (chunkData) {
                    result[viewportX][viewportY] = chunkData[positionInChunk];
                }
            }
        }

        return result;
    }
}
