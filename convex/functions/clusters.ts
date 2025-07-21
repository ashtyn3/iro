import { decode, encode } from "@msgpack/msgpack";
import type { Cluster, Clusters } from "../../src/lib/map";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import schema from "../schema";

export const saveClusters = mutation(
	async (
		{ db, auth },
		{
			tileSetId,
			clusters,
		}: {
			tileSetId: string;
			clusters: Clusters;
		},
	) => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");

		Object.keys(clusters).forEach(async (k) => {
			const group = clusters[k as unknown as keyof Clusters];
			await db.insert("clusters", {
				tileSetId: tileSetId as Id<"tileSets">,
				kind: parseInt(k),
				data: encodeToArrayBuffer(group),
			});
		});
	},
);

export const loadClusters = query(
	async ({ db }, { tileSetId }: { tileSetId: string }): Promise<Clusters> => {
		const rows = await db
			.query("clusters")
			.withIndex("byTileSetId", (q) =>
				q.eq("tileSetId", tileSetId as Id<"tileSets">),
			)
			.collect();
		const result: Clusters = {
			0: [],
			1: [],
			2: [],
			3: [],
			4: [],
			5: [],
			6: [],
			7: [],
			8: [],
		};
		for (const row of rows) {
			result[row.kind as keyof Clusters] = decode(row.data) as Cluster[];
		}
		return result;
	},
);

export const updateClusters = mutation(
	async (
		{ db, auth },
		{
			tileSetId,
			clusters,
		}: {
			tileSetId: string;
			clusters: Clusters;
		},
	): Promise<void> => {
		const user = await auth.getUserIdentity();
		if (!user) throw new Error("Not signed in");

		console.log(tileSetId);

		const existing = await db
			.query("clusters")
			.withIndex("byTileSetId", (q) =>
				q.eq("tileSetId", tileSetId as Id<"tileSets">),
			)
			.collect();
		const existingByKind = new Map<number, string>();
		for (const row of existing) {
			existingByKind.set(row.kind, row._id);
		}

		for (const kindKey of Object.keys(clusters)) {
			const kind = parseInt(kindKey, 10);
			const dataStr = encodeToArrayBuffer(clusters[kind as keyof Clusters]);
			if (existingByKind.has(kind)) {
				await db.patch(existingByKind.get(kind) as Id<"clusters">, {
					data: dataStr,
				});
				existingByKind.delete(kind);
			} else {
				await db.insert("clusters", {
					tileSetId: tileSetId as Id<"tileSets">,
					data: dataStr,
					kind: kind,
				});
			}
		}

		for (const orphanId of existingByKind.values()) {
			await db.delete(orphanId as Id<"clusters">);
		}
	},
);

function encodeToArrayBuffer(group: Cluster[]): ArrayBuffer {
	const encoded = encode(group);
	return encoded.buffer.slice(
		encoded.byteOffset,
		encoded.byteOffset + encoded.byteLength,
	);
}
