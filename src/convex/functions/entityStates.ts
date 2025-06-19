import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const saveEntityState = mutation({
    args: {
        tileSetId: v.id("tileSets"),
        entityId: v.string(),
        state: v.any(),
    },
    handler: async ({ db }, { tileSetId, entityId, state }) => {
        await db.insert("entityStates", {
            tileSetId,
            entityId,
            state,
        })
    }
})