import type {
	BlockData,
	Clusters,
	GameSettings,
	MapInfo,
	TileSetParams,
	TileUpdate,
	UpdateViewportResult,
	Viewport,
} from "../renderer/src/lib/types";

export enum StoreType {
	Map = "map",
	Settings = "settings",
	Entities = "entities",
}

export interface StorageAPI {
	// Map management
	createTileSet: (params: TileSetParams) => Promise<string>;
	getAllMaps: () => Promise<MapInfo[]>;

	// Block operations
	insertTileBlocks: (tileSetId: string, blocks: BlockData[]) => Promise<void>;
	updateViewportTiles: (
		tileSetId: string,
		viewport: Viewport,
		tileUpdates: TileUpdate[],
	) => Promise<UpdateViewportResult>;
	loadMapContent: (mapId: string) => Promise<{ blocks: any[]; meta: any }>;

	// Cluster operations
	saveClusters: (mapId: string, clusters: Clusters) => Promise<void>;
	loadCluster: (mapId: string) => Promise<Clusters | null>;
	clusterUpdate: (tileSetId: string, clusters: Clusters) => Promise<void>;

	// Entity operations
	saveEntityState: (
		tileSetId: string,
		entityId: string,
		state: string,
	) => Promise<void>;
	getEntityState: (
		tileSetId: string,
		entityId: string,
	) => Promise<string | null>;
	clearEntityStates: (tileSetId: string) => Promise<void>;

	// Cleanup operations
	clearUserData: () => Promise<void>;
	death: (tileSetId: string) => Promise<void>;

	// Settings operations
	hasSettings: () => Promise<boolean>;
	getSettings: () => Promise<GameSettings | undefined>;
	createSettings: () => Promise<void>;
	updateSettings: (settings: GameSettings) => Promise<void>;
}
