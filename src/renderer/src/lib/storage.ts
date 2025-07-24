// import { decode, encode } from "@msgpack/msgpack";
// import fs from "fs";
// import { nanoid } from "nanoid";
// import path from "path";
// import type { Cluster, Clusters } from "./map";

// export enum StoreType {
// 	Map = "map",
// 	Settings = "settings",
// 	Entities = "entities",
// }

// const DIR_MAPPING: Record<StoreType, string> = {
// 	[StoreType.Map]: "./data/maps",
// 	[StoreType.Settings]: "./data/settings",
// 	[StoreType.Entities]: "./data/entities",
// };

// function encodeToArrayBuffer(data: any): ArrayBuffer {
// 	const encoded = encode(data);
// 	return encoded.buffer.slice(
// 		encoded.byteOffset,
// 		encoded.byteOffset + encoded.byteLength,
// 	);
// }

// function decodeFromArrayBuffer(buffer: ArrayBuffer): any {
// 	const uint8Array = new Uint8Array(buffer);
// 	return decode(uint8Array);
// }

// export class Storage {
// 	private static _instance: Storage | null = null;

// 	private constructor() {
// 		if (Storage._instance) {
// 			return;
// 		}
// 		this.ensureMappings();
// 		Storage._instance = this;
// 	}

// 	public static get instance(): Storage {
// 		if (!Storage._instance) {
// 			Storage._instance = new Storage();
// 		}
// 		return Storage._instance;
// 	}

// 	private ensureMappings() {
// 		for (const type of Object.values(StoreType)) {
// 			const dir = DIR_MAPPING[type];
// 			if (!fs.existsSync(dir)) {
// 				fs.mkdirSync(dir, { recursive: true });
// 			}
// 		}
// 	}

// 	public async createMap({ width, height }: { width: number; height: number }) {
// 		const mapDir = DIR_MAPPING[StoreType.Map];
// 		const mapId = nanoid();
// 		const mapPath = path.join(mapDir, mapId);
// 		fs.mkdirSync(mapPath, { recursive: true });
// 		fs.writeFileSync(
// 			path.join(mapPath, "map.data"),
// 			JSON.stringify({ width, height }),
// 		);
// 		return mapId;
// 	}

// 	public async saveMapContent(
// 		mapId: string,
// 		content: { blockX: number; blockY: number; data: ArrayBuffer }[],
// 	) {
// 		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);
// 		for (const block of content) {
// 			const filePath = path.join(
// 				mapPath,
// 				`BLK.${block.blockX}.${block.blockY}.data`,
// 			);
// 			const encoded = encodeToArrayBuffer(block);
// 			fs.writeFileSync(filePath, new Uint8Array(encoded));
// 		}
// 	}

// 	public async loadMapContent(mapId: string) {
// 		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);
// 		const files = fs.readdirSync(mapPath);
// 		const blocks: { blockX: number; blockY: number; data: ArrayBuffer }[] = [];
// 		let header = { height: 0, width: 0 };
// 		files.forEach((file) => {
// 			if (file.startsWith("BLK.")) {
// 				const filePath = path.join(mapPath, file);
// 				const data = fs.readFileSync(filePath);
// 				const block = decodeFromArrayBuffer(data) as {
// 					blockX: number;
// 					blockY: number;
// 					data: ArrayBuffer;
// 				};
// 				blocks.push(block);
// 			} else if (file.startsWith("map")) {
// 				const filePath = path.join(mapPath, file);
// 				const data = fs.readFileSync(filePath, "utf8");
// 				header = JSON.parse(data) as { height: number; width: number };
// 			}
// 		});
// 		return { blocks, meta: header };
// 	}

// 	public async saveCluster(mapId: string, cluster: Cluster) {
// 		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);
// 		const filePath = path.join(mapPath, `CLUSTER.${cluster.kind}.data`);
// 		const encoded = encodeToArrayBuffer(cluster);
// 		fs.writeFileSync(filePath, new Uint8Array(encoded));
// 	}

// 	public async loadCluster(mapId: string) {
// 		const mapPath = path.join(DIR_MAPPING[StoreType.Map], mapId);
// 		const files = fs.readdirSync(mapPath);
// 		const clusters: Clusters = {} as any;

// 		files.forEach((file) => {
// 			if (file.startsWith("CLUSTER.")) {
// 				const filePath = path.join(mapPath, file);
// 				const data = fs.readFileSync(filePath);
// 				const cluster = decodeFromArrayBuffer(data) as Cluster;
// 				clusters[cluster.kind] = cluster;
// 			}
// 		});
// 		return clusters;
// 	}

// 	public async clusterUpdate(tileSetId: string, clusters: Clusters) {
// 		const mapPath = path.join(DIR_MAPPING[StoreType.Map], tileSetId);

// 		// Get existing cluster files
// 		const existingFiles = fs.existsSync(mapPath) ? fs.readdirSync(mapPath) : [];
// 		const existingByKind = new Map<number, string>();

// 		// Parse existing cluster files to get kind -> filename mapping
// 		for (const file of existingFiles) {
// 			if (file.startsWith("CLUSTER.")) {
// 				const parts = file.split(".");
// 				if (parts.length >= 3) {
// 					const kind = parseInt(parts[1], 10);
// 					existingByKind.set(kind, file);
// 				}
// 			}
// 		}

// 		// Update or create clusters
// 		for (const kindKey of Object.keys(clusters)) {
// 			const kind = parseInt(kindKey, 10);
// 			const cluster = clusters[kind as keyof Clusters];
// 			const dataStr = encodeToArrayBuffer(cluster);
// 			const fileName = `CLUSTER.${kind}.data`;

// 			if (existingByKind.has(kind)) {
// 				// Update existing cluster
// 				const filePath = path.join(mapPath, fileName);
// 				fs.writeFileSync(filePath, new Uint8Array(dataStr));
// 				existingByKind.delete(kind);
// 			} else {
// 				// Create new cluster
// 				const filePath = path.join(mapPath, fileName);
// 				fs.writeFileSync(filePath, new Uint8Array(dataStr));
// 			}
// 		}

// 		// Delete orphaned clusters (existing ones not in the new clusters)
// 		for (const orphanFileName of existingByKind.values()) {
// 			const orphanPath = path.join(mapPath, orphanFileName);
// 			fs.unlinkSync(orphanPath);
// 		}
// 	}

// 	public async saveEntityState(
// 		tileSetId: string,
// 		entityId: string,
// 		state: any,
// 	) {
// 		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);
// 		if (!fs.existsSync(entityPath)) {
// 			fs.mkdirSync(entityPath, { recursive: true });
// 		}

// 		const filePath = path.join(entityPath, `ENTITY.${entityId}.data`);
// 		const encoded = encodeToArrayBuffer(state);
// 		fs.writeFileSync(filePath, new Uint8Array(encoded));
// 	}

// 	public async getEntityState(
// 		tileSetId: string,
// 		entityId: string,
// 	): Promise<any | null> {
// 		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);
// 		const filePath = path.join(entityPath, `ENTITY.${entityId}.data`);

// 		if (!fs.existsSync(filePath)) {
// 			return null;
// 		}

// 		const data = fs.readFileSync(filePath);
// 		return decodeFromArrayBuffer(data);
// 	}

// 	public async clearEntityStates(tileSetId: string) {
// 		const entityPath = path.join(DIR_MAPPING[StoreType.Entities], tileSetId);

// 		if (!fs.existsSync(entityPath)) {
// 			return;
// 		}

// 		const files = fs.readdirSync(entityPath);
// 		for (const file of files) {
// 			if (file.startsWith("ENTITY.")) {
// 				const filePath = path.join(entityPath, file);
// 				fs.unlinkSync(filePath);
// 			}
// 		}
// 	}
// }

// export const storage = Storage.instance;

import type { StorageAPI } from "../../../shared/storage-types";

export const Storage = {
	instance: (window as any).electronAPI.storage as StorageAPI,
};