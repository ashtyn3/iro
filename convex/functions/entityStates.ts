import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const saveEntityState = mutation({
    args: {
        tileSetId: v.id("tileSets"),
        entityId: v.string(),
        state: v.any(),
    },
    handler: async ({ db }, { tileSetId, entityId, state }) => {
        const existing = await db
            .query("entityStates")
            .withIndex("byTileSetId", q => q.eq("tileSetId", tileSetId))
            .filter(q => q.eq(q.field("entityId"), entityId))
            .first();
        if (existing) {
            await db.patch(existing._id, {
                state,
            })
        } else {
            await db.insert("entityStates", {
                tileSetId,
                entityId,
                state,
            })
        }
    }
})
export const getEntityState = query({
    args: {
        tileSetId: v.id("tileSets"),
        entityId: v.string(),
    },
    handler: async ({ db }, { tileSetId, entityId }) => {
        const existing = await db
            .query("entityStates")
            .withIndex("byTileSetId", q => q.eq("tileSetId", tileSetId))
            .filter(q => q.eq(q.field("entityId"), entityId))
            .first();
        return existing?.state ?? null;
    }
})