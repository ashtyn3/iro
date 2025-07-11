// entity.ts

import {
	type AddedOf,
	applyMixins,
	type Component,
	type ParamsOf,
	type UnionToIntersection,
} from "./comps";
import type { Engine } from "./index";
import { Inventory } from "./inventory";
import { Air } from "./player";
import { Vec2d } from "./state";
import { Syncable } from "./sync";
import {
	Collectable,
	Destructible,
	type Entity,
	type Existable,
	Movable,
	Storeable,
	Timed,
} from "./traits";

export type EntityTypes = "norm" | "destructable" | "collectable";

export function createEntity(
	e: Engine,
	char: string,
	fg?: string,
	bg?: string,
): Entity {
	return {
		engine: e,
		char: char,
		fg,
		bg,
	};
}

export class EntityBuilder<M extends Array<Component<any, any>> = []> {
	private entries: Array<[Component<any, any>, any]>;

	constructor(
		private base: Existable,
		entries?: Array<[Component<any, any>, any]>,
	) {
		this.entries = entries ?? [];
	}

	add<Mi extends Component<any, any>>(
		fn: Mi,
		params: ParamsOf<Mi>,
	): EntityBuilder<[...M, Mi]> {
		const nextEntries = [...this.entries, [fn, params]] as Array<
			[Component<any, any>, any]
		>;
		this.entries = nextEntries;

		return this as unknown as EntityBuilder<[...M, Mi]>;
	}

	build(): Existable & UnionToIntersection<AddedOf<M[number]>> {
		return applyMixins(this.base, ...this.entries) as any;
	}
}

export function promote(
	e: Engine,
	pos: Vec2d,
	params?: { [key: string]: any },
): Entity {
	const tile = e.mapBuilder.tiles[pos.x][pos.y];
	const entity: Entity = createEntity(e, tile.char, tile.fg, tile.bg);
	const builder = new EntityBuilder(entity);

	const make_entity = (type: string) => {
		type.split(",").forEach((t) => {
			switch (t) {
				case "collectable":
					builder.add(Collectable, {});
					break;
				case "destructable":
					builder.add(Destructible, 15);
					break;
			}
		});
	};
	if (tile.mask) {
		if (tile.mask.promotable) {
			make_entity(tile.mask.promotable.type);
		} else if (tile.promotable) {
			make_entity(tile.promotable.type);
		}
		const builtEntity = builder.build() as Entity;
		e.state.entities = e.state.entities.set(pos, builtEntity);
		return builtEntity;
	}
	return entity;
}

export function deserializeEntity(
	engine: Engine,
	data: any,
	existingEntity?: Entity,
): Entity {
	const entityToBuildOn =
		existingEntity ?? createEntity(engine, data.char, data.fg, data.bg);
	const builder = new EntityBuilder(entityToBuildOn);

	if (data.position) {
		builder.add(Movable, Vec2d(data.position));
	}
	if (data.health !== undefined) {
		builder.add(Destructible, data.health);
	}
	if (data.act !== undefined) {
		builder.add(Timed, data.act);
	}
	if (data.Items !== undefined || data.slots !== undefined) {
		builder.add(Inventory, {
			slots: data.slots || 5,
			dominant: data.dominant || "right",
			Items: data.Items,
			hands: data.hands,
		});
	}
	if (data.air !== undefined) {
		builder.add(Air, {});
	}

	if (data.syncable && !(existingEntity as any)?.syncable) {
		builder.add(Syncable, data.id);
	}

	if (data.id) {
		builder.add(Storeable, data.id);
	}

	const builtEntity = builder.build() as Entity;

	if (existingEntity) {
		Object.assign(existingEntity, builtEntity);
		return existingEntity;
	}

	return builtEntity;
}
