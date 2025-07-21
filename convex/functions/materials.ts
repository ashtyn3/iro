import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";

export const saveMaterials = mutation(
	async (
		{ db },
		{
			tileSetId,
			materials,
		}: { tileSetId: Id<"tileSets">; materials: ArrayBuffer },
	) => {
		await db.insert("materials", {
			tileSetId,
			data: materials,
		});
	},
);

export const loadMaterials = query(
	async ({ db }, { tileSetId }: { tileSetId: Id<"tileSets"> }) => {
		const materials = await db
			.query("materials")
			.withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
			.unique();
		return materials?.data ?? new ArrayBuffer(0);
	},
);
