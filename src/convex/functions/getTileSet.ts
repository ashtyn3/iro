import { query } from "../_generated/server";
import schema from "../schema";

// 1) Make sure you have an index on tileBlocks by tileSetId in your schema:
//    in convex/schemas.ts:
//
//    table("tileBlocks", {
//      tileSetId: id("tileSets"),
//      blockX: number(),
//      blockY: number(),
//      data: json(),
//    }).index("byTileSetId", ["tileSetId"]);
//
// 2) Now the query:
export const getTileSet = query(
    async (
        { db },
        { tileSetId }: { tileSetId: string }
    ): Promise<{
        meta: typeof schema.tables.tileSets.validator.type;
        blocks: typeof schema.tables.tileBlocks.validator.type[];
    }> => {
        const meta = await db.get(tileSetId);
        if (!meta) throw new Error("TileSet not found: " + tileSetId);

        const blocks = await db
            .query("tileBlocks")
            .withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
            .collect();

        return { meta, blocks };
    }
);
export const getTileSets = query(
    async ({ db, auth }): Promise<
        Array<{
            id: string;
            width: number;
            height: number;
            createdAt: string;
        }>
    > => {
        // 1) who is calling?
        const user = await auth.getUserIdentity();
        if (!user) throw new Error("Not signed in");

        // 2) find your Convex user record
        const u = await db
            .query("users")
            .withIndex("byExternalId", (q) =>
                q.eq("externalId", user.subject)
            )
            .unique();
        if (!u) return [];

        // 3) fetch all tileSets you own
        const sets = await db
            .query("tileSets")
            .withIndex("byOwner", (q) => q.eq("owner", u._id))
            .collect();

        return sets.map((s) => ({
            id: s._id,
            width: s.width,
            height: s.height,
            createdAt: s.createdAt,
        }));
    }
);
