import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

export const saveEntityState = mutation({
	args: {
		tileSetId: v.id("tileSets"),
		entityId: v.string(),
		state: v.any(),
	},
	handler: async ({ db }, { tileSetId, entityId, state }) => {
		const existing = await db
			.query("entityStates")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.filter((q) => q.eq(q.field("entityId"), entityId))
			.first();
		if (existing) {
			await db.patch(existing._id, {
				state,
			});
		} else {
			await db.insert("entityStates", {
				tileSetId,
				entityId,
				state,
			});
		}
	},
});
export const getEntityState = query({
	args: {
		tileSetId: v.id("tileSets"),
		entityId: v.string(),
	},
	handler: async ({ db }, { tileSetId, entityId }) => {
		const existing = await db
			.query("entityStates")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.filter((q) => q.eq(q.field("entityId"), entityId))
			.first();
		return existing?.state ?? null;
	},
});

export const clearEntityStates = internalMutation({
	args: { cursor: v.optional(v.string()), tileSetId: v.id("tileSets") },
	handler: async ({ db, scheduler }, { cursor, tileSetId }) => {
		const batch = await db
			.query("entityStates")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.paginate({ cursor: cursor ?? null, numItems: 40 });
		for (const entityState of batch.page) {
			await db.delete(entityState._id);
		}

		if (!batch.isDone) {
			await scheduler.runAfter(
				0,
				internal.functions.entityStates.clearEntityStates,
				{ cursor: batch.continueCursor, tileSetId },
			);
		}
	},
});
