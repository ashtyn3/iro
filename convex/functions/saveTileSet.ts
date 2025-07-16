import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";

export const canMakeMap = query(async ({ db, auth }) => {
	const user = await auth.getUserIdentity();
	if (!user) throw new Error("Not signed in");
	const u = await db
		.query("users")
		.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
		.unique();
	if (!u) throw new Error("User record missing");
	const t = await db
		.query("tileSets")
		.withIndex("byOwner", (q) => q.eq("owner", u._id))
		.collect();
	if (t.length > 0)
		return {
			state: false,
			message: "You already have a map. Delete it to create a new one.",
		};

	return { state: true, message: "You can create a new map" };
});

export const death = mutation(
	async (
		{ db, auth, scheduler },
		{ tileSetId }: { tileSetId: Id<"tileSets"> },
	) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");
		const u = await db
			.query("users")
			.withIndex("byExternalId", (q) => q.eq("externalId", user.subject))
			.unique();
		if (!u) throw new Error("User record missing");

		await scheduler.runAfter(
			0,
			internal.functions.saveTileSet.clearTileBlocksBatch,
			{ tileSetId, userId: u._id },
		);
		await scheduler.runAfter(
			0,
			internal.functions.saveTileSet.clearClustersBatch,
			{ tileSetId, userId: u._id },
		);
		await scheduler.runAfter(
			0,
			internal.functions.saveTileSet.clearTileSetBatch,
			{ tileSetId, userId: u._id },
		);
		await scheduler.runAfter(
			0,
			internal.functions.entityStates.clearEntityStates,
			{ tileSetId },
		);
	},
);

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

export const insertTileBlocks = mutation(
	async (
		{ db },
		{
			tileSetId,
			blocks,
		}: {
			tileSetId: Id<"tileSets">;
			blocks: Array<{
				blockX: number;
				blockY: number;
				data: ArrayBuffer;
			}>;
		},
	) => {
		for (const { blockX, blockY, data } of blocks) {
			await db.insert("tileBlocks", {
				tileSetId,
				blockX,
				blockY,
				data: data,
			});
		}
	},
);

export const updateViewportTiles = mutation(
	async (
		{ db, auth },
		{
			tileSetId,
			blockUpdates,
		}: {
			tileSetId: Id<"tileSets">;
			blockUpdates: Array<{
				blockX: number;
				blockY: number;
				data: ArrayBuffer;
			}>;
		},
	) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");

		const meta = await db.get(tileSetId);
		if (!meta) throw new Error("tileSet not found: " + tileSetId);

		let updatedBlocksCount = 0;

		for (const { blockX, blockY, data } of blockUpdates) {
			const rec = await db
				.query("tileBlocks")
				.withIndex("byTileSetAndPos", (q) =>
					q
						.eq("tileSetId", tileSetId)
						.eq("blockX", blockX)
						.eq("blockY", blockY),
				)
				.unique();

			if (!rec) {
				throw new Error(
					`Missing block (${blockX},${blockY}) in tileset ${tileSetId}`,
				);
			}

			await db.patch(rec._id, { data });
			updatedBlocksCount++;
		}

		return {
			updatedBlocks: updatedBlocksCount,
		};
	},
);

export const clearTileBlocksBatch = internalMutation({
	args: {
		tileSetId: v.id("tileSets"),
		cursor: v.optional(v.string()),
		userId: v.id("users"),
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
	args: { tileSetId: v.id("tileSets"), userId: v.id("users") },
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
	args: { cursor: v.optional(v.string()), userId: v.id("users") },
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
		userId: v.id("users"),
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
