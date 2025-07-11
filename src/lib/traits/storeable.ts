import SuperJSON from "superjson";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Component } from "../comps";
import type { Syncable } from "../sync";
import type { Entity, Existable } from "./types";

export interface Storeable extends Entity {
	store: () => Promise<void>;
	id: string;
	serialize: () => any;
	deserialize: (data: any) => void;
	sync: () => Promise<void>;
}

export const Storeable: Component<Storeable, string> = (base, init) => {
	const e = base as Entity & Storeable & Syncable;
	e.id = init;

	e.sync = async () => {
		const state = await e.engine.convex.query(
			api.functions.entityStates.getEntityState,
			{
				tileSetId: e.engine.mapBuilder.mapId as Id<"tileSets">,
				entityId: e.id,
			},
		);
		if (state) {
			// Import the deserializeEntity function from the main entity file
			const { deserializeEntity } = await import("../entity");
			deserializeEntity(e.engine, SuperJSON.parse(state), e);
		}
	};

	e.serialize = () => {
		const { engine, ...serializableEntity } = e;
		return serializableEntity;
	};

	e.deserialize = (data: any) => {
		Object.assign(e, data);
	};

	e.store = async () => {
		await e.engine.convex.mutation(api.functions.entityStates.saveEntityState, {
			tileSetId: e.engine.mapBuilder.mapId as Id<"tileSets">,
			entityId: e.id,
			state: SuperJSON.stringify(e.serialize()),
		});
	};
	return e;
};
