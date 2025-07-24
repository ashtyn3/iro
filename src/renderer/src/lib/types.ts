import * as immutable from "immutable";
import type { Material } from "./generators/material_gen";
import type { Cluster, Clusters, Tile } from "./map";
import type { Movable } from "./traits";
import type { Entity, Existable } from "./traits/types";

export interface IVec2d {
	x: number;
	y: number;
}

export const Vec2d = immutable.Record<IVec2d>({
	x: 0,
	y: 0,
});
export type Vec2d = ReturnType<typeof Vec2d>;

export interface Viewport {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface MapInfo {
	id: string;
	width: number;
	height: number;
	createdAt: string;
	name: string;
}

export interface TileSetParams {
	width: number;
	height: number;
	name: string;
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

export interface BlockData {
	blockX: number;
	blockY: number;
	data: ArrayBuffer;
}

export interface TileUpdate {
	x: number; // relative to viewport
	y: number; // relative to viewport
	tile: Tile;
}

export interface GameState {
	currentCluster: Cluster | null;
}

export type GameMenuState = "Menu" | "select" | "loading" | "game" | "settings";

export interface MapGenerationResult {
	state: boolean;
	message: string;
}

export type EntityTypes = "norm" | "destructable" | "collectable";

export interface EntityMap {
	entities: immutable.Map<Vec2d, Entity>;
}

export interface Item {
	name: string;
	sprite: string[];
	usable: boolean;
}

export interface InventoryItem {
	count: number;
	item: Item;
}

export interface Handedness {
	right: Item;
	left: Item;
}

export type DominantHand = "right" | "left";

export interface GameSettings {
	keyMap: any;
	handed: string;
}

export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface UpdateViewportResult {
	updatedBlocks: number;
}

export interface FileImportResult {
	success: boolean;
	message: string;
	data?: any;
}

export interface CompressionResult {
	success: boolean;
	data?: ArrayBuffer;
	error?: string;
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncFunction<TArgs extends any[] = any[], TReturn = any> = (
	...args: TArgs
) => Promise<TReturn>;

export type SyncFunction<TArgs extends any[] = any[], TReturn = any> = (
	...args: TArgs
) => TReturn;

export interface GameEvent {
	type: string;
	data?: any;
	timestamp: number;
}

export interface InputEvent {
	key: string;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
}

export interface RenderContext {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	viewport: Viewport;
}

export interface SpriteData {
	char: string;
	fg: string;
	bg: string;
}

export interface SimulationTick {
	dt: number;
	timestamp: number;
}

export interface PhysicsBody {
	position: Vec2d;
	velocity: Vec2d;
	mass: number;
}

export interface SyncData {
	id: string;
	timestamp: number;
	data: any;
}

export interface NetworkMessage {
	type: string;
	payload: any;
	timestamp: number;
	sender?: string;
}

export interface LogEntry {
	level: "info" | "warn" | "error" | "debug";
	message: string;
	timestamp: number;
	context?: any;
}

export interface DebugInfo {
	version: string;
	buildTime: string;
	environment: string;
}

export interface GameConfig {
	version: string;
	debug: boolean;
	maxEntities: number;
	tickRate: number;
	blockSize: number;
}

export interface WorldConfig {
	width: number;
	height: number;
	seed?: number;
	biomes?: string[];
}

export type { Entity, Existable, Movable, Material, Cluster, Clusters, Tile };
