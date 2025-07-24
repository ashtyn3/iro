import * as Immutable from "immutable";
import type { Engine } from ".";
import type { AddedOf, Component, UnionToIntersection } from "./comps";
import { Debug } from "./debug";
import { createEntity, EntityBuilder, EntityRegistry } from "./entity";
import { VIEWPORT } from "./map";
import { Movable, Named } from "./traits";
import type { Entity, Existable } from "./traits/types";
import type { Vec2d } from "./types";

export interface GObject extends Existable {
	size: Vec2d;
	sprite: string[];
	bg: string;
	fg: string;
	inViewport: () => boolean;
}

export interface Unique extends Existable {
	id: string;
}

export const Unique: Component<Unique, {}> = (base) => {
	const e = base as Entity & Unique;
	e.id = crypto.randomUUID();
	return e;
};

export function createGObject(
	e: Engine,
	kind: string,
	size: Vec2d,
	origin: Vec2d,
	sprite: string[],
) {
	const base: GObject = {
		engine: e,
		_components: Immutable.Set([Symbol.for("GObject")]),
		size,
		sprite,
		fg: "",
		bg: "",
		inViewport: () => {
			const vp = e.viewport();
			return (
				origin.x >= vp.x &&
				origin.x <= vp.x + VIEWPORT.x &&
				origin.y >= vp.y &&
				origin.y <= vp.y + VIEWPORT.y
			);
		},
	};
	const built = new EntityBuilder(base)
		.add(Named, { name: kind })
		.add(Movable, origin)
		.add(Unique, {})
		.build();

	return built;
}

export type GObjectBase = GObject & Named & Unique & Movable;

export function extendGObject(base: GObjectBase) {
	const entity = EntityRegistry.instance.lookupByName(base.name);
	if (!entity) {
		Debug.getInstance().error(`GObject ${base.name} not found`);
		throw new Error(`GObject ${base.name} not found`);
	}
	EntityRegistry.instance.deleteAndQuery([Named], (e) => e.name === base.name);

	return new EntityBuilder(entity as unknown as GObjectBase);
}
