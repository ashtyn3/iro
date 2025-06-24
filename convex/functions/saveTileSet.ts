import type { Tile } from "$lib/map";
import { internalMutation, mutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";

// 1) Create just the tileset record
export const createTileSet = mutation(
	async (
		{ db, auth },
		{ width, height }: { width: number; height: number },
	) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");
		return db.insert("tileSets", {
			width,
			height,
			createdAt: new Date().toISOString(),
			owner: u._id,
		});
	},
);

// 2) Insert *blocks* of tiles, one small array at a time
export const insertTileBlocks = mutation(
	async (
		{ db },
		{
			tileSetId,
			blocks,
		}: {
			tileSetId: string;
			blocks: Array<{
				blockX: number;
				blockY: number;
				data: any[][];
			}>;
		},
	) => {
		for (const { blockX, blockY, data } of blocks) {
			await db.insert("tileBlocks", {
				tileSetId,
				blockX,
				blockY,
				data,
			});
		}
	},
);

export const updateViewportTiles = mutation(
	async (
		{ db, auth },
		{
			tileSetId,
			viewport,
			blockSize,
			tileUpdates,
		}: {
			tileSetId: string;
			viewport: { x: number; y: number; width: number; height: number };
			blockSize: number;
			tileUpdates: Array<{ x: number; y: number; tile: Tile }>;
		},
	) => {
		// 1) auth / ownership check (optional)
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");

		// 2) fetch metadata to bounds‐check
		const meta = await db.get(tileSetId);
		if (!meta) throw new Error("tileSet not found: " + tileSetId);
		const { width: totalWidth, height: totalHeight } = meta;

		// 3) group updates by block:
		type BlockKey = string; // "bx,by"
		interface BlockInfo {
			id: string;
			data: Tile[][];
			modified: boolean;
		}
		const blocks = new Map<BlockKey, BlockInfo>();

		for (const upd of tileUpdates) {
			// 3a) validate relative coords
			if (
				upd.x < 0 ||
				upd.y < 0 ||
				upd.x >= viewport.width ||
				upd.y >= viewport.height
			) {
				throw new Error(
					`Update (${upd.x},${upd.y}) outside viewport ${JSON.stringify(
						viewport,
					)}`,
				);
			}

			// 3b) compute actual coords
			const ax = viewport.x + upd.x;
			const ay = viewport.y + upd.y;
			if (ax < 0 || ay < 0 || ax >= totalWidth || ay >= totalHeight) {
				throw new Error(`Actual coord (${ax},${ay}) out of bounds`);
			}

			// 3c) which block?
			const bx = Math.floor(ax / blockSize);
			const by = Math.floor(ay / blockSize);
			const key = `${bx},${by}`;

			// 3d) lazy‐load block
			if (!blocks.has(key)) {
				const rec = await db
					.query("tileBlocks")
					.withIndex("byTileSetAndPos", (q) =>
						q.eq("tileSetId", tileSetId).eq("blockX", bx).eq("blockY", by),
					)
					.unique();
				if (!rec) {
					throw new Error(
						`Missing block (${bx},${by}) in tileset ${tileSetId}`,
					);
				}
				blocks.set(key, {
					id: rec._id,
					data: rec.data as Tile[][],
					modified: false,
				});
			}

			// 3e) apply the single‐tile change inside its block array
			const info = blocks.get(key)!;
			const localX = ax - bx * blockSize;
			const localY = ay - by * blockSize;
			info.data[localX][localY] = upd.tile;
			info.modified = true;
		}

		// 4) write back only the blocks we touched
		for (const { id, data, modified } of blocks.values()) {
			if (modified) {
				await db.patch(id, { data });
			}
		}

		return {
			updatedTiles: tileUpdates.length,
			updatedBlocks: [...blocks.values()].filter((b) => b.modified).length,
		};
	},
);

export const clearTileBlocksBatch = internalMutation({
	args: {
		tileSetId: v.id("tileSets"),
		cursor: v.optional(v.string()),
		userId: v.string(),
	},
	handler: async ({ db, scheduler }, { tileSetId, cursor, userId }) => {
		const batch = await db
			.query("tileBlocks")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.paginate({ cursor: cursor ?? null, numItems: 40 });

		for (const tileBlock of batch.page) {
			await db.delete(tileBlock._id);
		}

		if (!batch.isDone) {
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearTileBlocksBatch,
				{
					tileSetId,
					cursor: batch.continueCursor,
					userId,
				},
			);
		} else {
			await db.patch(tileSetId, { empty_blocks: true });
		}
	},
});

export const clearTileSetBatch = internalMutation({
	args: { tileSetId: v.id("tileSets"), userId: v.string() },
	handler: async ({ db, scheduler }, { tileSetId, userId }) => {
		const batch = await db
			.query("tileSets")
			.withIndex("byOwner", (q) => q.eq("owner", userId))
			.collect();

		let wait = false;
		for (const tileSet of batch) {
			if (tileSet.empty_blocks && tileSet.empty_clusters) {
				await db.delete(tileSet._id);
			} else {
				wait = true;
			}
		}

		if (wait) {
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearTileSetBatch,
				{
					tileSetId,
					userId,
				},
			);
		}
	},
});

export const clearUserDataBatch = internalMutation({
	args: { cursor: v.optional(v.string()), userId: v.string() },
	handler: async ({ db, scheduler }, { cursor, userId }) => {
		const batch = await db
			.query("tileSets")
			.withIndex("byOwner", (q) => q.eq("owner", userId))
			.paginate({ cursor: cursor ?? null, numItems: 10 });
		console.log("clearing user data batch", batch.page.length);

		for (const tileSet of batch.page) {
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearTileBlocksBatch,
				{ tileSetId: tileSet._id, userId },
			);
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearClustersBatch,
				{ tileSetId: tileSet._id, userId },
			);
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearTileSetBatch,
				{ tileSetId: tileSet._id, userId },
			);
			await scheduler.runAfter(
				0,
				internal.functions.entityStates.clearEntityStates,
				{ tileSetId: tileSet._id },
			);
		}

		if (!batch.isDone) {
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearUserDataBatch,
				{
					cursor: batch.continueCursor,
					userId,
				},
			);
		}
	},
});

export const clearClustersBatch = internalMutation({
	args: {
		tileSetId: v.id("tileSets"),
		cursor: v.optional(v.string()),
		userId: v.string(),
	},
	handler: async ({ db, scheduler }, { tileSetId, cursor, userId }) => {
		const batch = await db
			.query("clusters")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.paginate({ cursor: cursor ?? null, numItems: 40 });

		for (const cluster of batch.page) {
			await db.delete(cluster._id);
		}

		if (!batch.isDone) {
			await scheduler.runAfter(
				0,
				internal.functions.saveTileSet.clearClustersBatch,
				{
					tileSetId,
					cursor: batch.continueCursor,
					userId,
				},
			);
		} else {
			await db.patch(tileSetId, { empty_clusters: true });
		}
	},
});

export const clearUserData = mutation({
	handler: async ({ scheduler, auth, db }) => {
		const me = await auth.getUserIdentity();
		if (!me) throw new Error("Not signed in");

		const id = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", me.subject))
			.unique();
		console.log("clearing user data", id);
		if (!id) throw new Error("User record missing");

		await scheduler.runAfter(
			0,
			internal.functions.saveTileSet.clearUserDataBatch,
			{ userId: id._id },
		);
	},
});
