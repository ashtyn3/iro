import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        name: v.string(),
        externalId: v.string(), // Clerk user ID
    }).index("byExternalId", ["externalId"]),

    tileSets: defineTable({
        width: v.number(),
        height: v.number(),
        // you can store a real Date rather than ISO‐string if you prefer:
        createdAt: v.string(),
        owner: v.id("users"),
        empty_blocks: v.optional(v.boolean()),
        empty_clusters: v.optional(v.boolean()),
    })
        // optionally index by owner if you need to list all sets for a user:
        .index("byOwner", ["owner"]),

    tileBlocks: defineTable({
        tileSetId: v.id("tileSets"),
        blockX: v.number(),
        blockY: v.number(),
        // store a 2D array of Tile objects
        data: v.array(v.array(v.any())),
    })
        .index("byTileSetId", ["tileSetId"])
        .index("byTileSetAndPos", ["tileSetId", "blockX", "blockY"]),

    clusters: defineTable({
        tileSetId: v.id("tileSets"),
        kind: v.number(),
        data: v.any(),
    })
        .index("byTileSetId", ["tileSetId"]).index("byIdAndKind", ["tileSetId", "kind"]),
});
