import SuperJSON from "superjson";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Component } from "../comps";
import { deserializeEntity } from "../entity";
import { DB } from "../state";
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
		const db = new DB(e.engine.convex);
		const state = await db.getEntityState(
			e.engine.mapBuilder.mapId as Id<"tileSets">,
			e.id,
		);
		if (state) {
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
		const db = new DB(e.engine.convex);
		await db.saveEntityState(
			e.engine.mapBuilder.mapId as Id<"tileSets">,
			e.id,
			SuperJSON.stringify(e.serialize()),
		);
	};
	return e;
};
