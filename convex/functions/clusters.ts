import { mutation, query } from "../_generated/server";
import schema from "../schema"; // wherever your TS type lives
import type { Clusters } from "../../lib/map"


export const saveClusters = mutation(
    async (
        { db, auth },
        {
            tileSetId,
            clusters,
        }: {
            tileSetId: string;
            clusters: Clusters;
        }
    ) => {
        // optional: enforce auth
        const user = await auth.getUserIdentity();
        if (!user) throw new Error("Not signed in");

        // insert and return the generated id
        Object.keys(clusters).forEach(async (k) => {
            const group = clusters[k]
            await db.insert("clusters", {
                tileSetId: tileSetId,
                kind: parseInt(k),
                data: JSON.stringify(group),
            });
        })

        // return id;
    }
);

export const loadClusters = query(
    async (
        { db },
        { tileSetId }: { tileSetId: string }
    ): Promise<Clusters> => {
        const rows = await db
            .query("clusters")
            .withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
            .collect();
        const result: Clusters = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: [],
            5: [],
            6: [],
            7: []
        };
        for (const row of rows) {
            result[row.kind] = JSON.parse(row.data);
        }
        return result;
    }
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
        }
    ): Promise<void> => {
        const user = await auth.getUserIdentity();
        if (!user) throw new Error("Not signed in");
        console.log(tileSetId)

        const existing = await db
            .query("clusters")
            .withIndex("byTileSetId", (q) => q.eq("tileSetId", tileSetId))
            .collect();
        const existingByKind = new Map<number, string>();
        for (const row of existing) {
            existingByKind.set(row.kind, row._id);
        }

        for (const kindKey of Object.keys(clusters)) {
            const kind = parseInt(kindKey, 10);
            const dataStr = JSON.stringify(clusters[kindKey]);
            if (existingByKind.has(kind)) {
                // patch
                await db.patch(existingByKind.get(kind)!, {
                    data: dataStr,
                });
                existingByKind.delete(kind);
            } else {
                // new insert
                await db.insert("clusters", {
                    tileSetId: tileSetId,
                    data: dataStr,
                    kind: kind
                });
            }
        }

        for (const orphanId of existingByKind.values()) {
            await db.delete(orphanId);
        }
    }
);
