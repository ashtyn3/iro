import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		name: v.string(),
		externalId: v.string(),
	}).index("byExternalId", ["externalId"]),

	tileSets: defineTable({
		width: v.number(),
		height: v.number(),

		createdAt: v.string(),
		owner: v.id("users"),
		empty_blocks: v.optional(v.boolean()),
		empty_clusters: v.optional(v.boolean()),
	}).index("byOwner", ["owner"]),
	materials: defineTable({
		tileSetId: v.id("tileSets"),
		data: v.bytes(),
	}).index("byTileSetId", ["tileSetId"]),

	settings: defineTable({
		keyMap: v.any(),
		handed: v.union(v.literal("left"), v.literal("right")),
		owner: v.id("users"),
	}).index("byOwner", ["owner"]),
	tileBlocks: defineTable({
		tileSetId: v.id("tileSets"),
		blockX: v.number(),
		blockY: v.number(),

		data: v.bytes(),
	})
		.index("byTileSetId", ["tileSetId"])
		.index("byTileSetAndPos", ["tileSetId", "blockX", "blockY"]),

	entityStates: defineTable({
		tileSetId: v.id("tileSets"),
		entityId: v.string(),
		state: v.any(),
	})
		.index("byTileSetId", ["tileSetId"])
		.index("byEntityId", ["entityId"]),

	clusters: defineTable({
		tileSetId: v.id("tileSets"),
		kind: v.number(),
		data: v.any(),
	})
		.index("byTileSetId", ["tileSetId"])
		.index("byIdAndKind", ["tileSetId", "kind"]),
});
