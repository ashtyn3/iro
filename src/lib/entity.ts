// entity.ts
import { Engine } from "./index";
import * as immutable from "immutable";
import { Vec2d } from "./state";
import type { Item } from "./inventory";
import { Inventory } from "./inventory";
import {
	applyMixins,
	type AddedOf,
	type Component,
	type ParamsOf,
	type UnionToIntersection,
} from "./comps";
import { VIEWPORT } from "./map";
import { api } from "../../convex/_generated/api";
import { Syncable } from "./sync";
import { Air } from "./player";
import SuperJSON from "superjson";
import type { Id } from "../../convex/_generated/dataModel";

export type EntityTypes = "norm" | "destructable" | "collectable";

export interface Existable {
	engine: Engine;
}

export interface Entity extends Existable {
	char: string;
	fg?: string;
	bg?: string;
}

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

export interface Renderable extends Existable {
	render: () => void;
}

export const Renderable: Component<Renderable, () => void> = (base, render) => {
	const e = base as Entity & Renderable;
	e.render = render;
	return e;
};

export interface Movable extends Entity {
	position: Vec2d;
	move: (delta: Vec2d) => void;
}

export const Movable: Component<Movable, Vec2d> = (base, init) => {
	const e = base as Entity & Movable;

	e.position = init;
	e.move = (delta: Vec2d): void => {
		const newX = e.position.x + delta.x;
		const newY = e.position.y + delta.y;

		const oldPositionKey = e.position;
		const newPositionKey = Vec2d({ x: newX, y: newY }); // Create new Immutable Vec2d Record for potential new key

		if (
			newY >= e.engine.height ||
			newX >= e.engine.width ||
			newX < 0 ||
			newY < 0
		)
			return;
		if (e.engine.mapBuilder.tiles[newX][newY].boundary) return;

		if (oldPositionKey.equals(newPositionKey)) {
			return;
		}
		e.position = newPositionKey;
	};

	return e;
};

export interface Destructible extends Entity {
	health: number;
	damage(amount: number): void;
}
export const Destructible: Component<Destructible, number> = (
	base,
	initialHealth,
) => {
	const e = base as Entity & Destructible;
	// cast once to the widened type
	// add your data & methods
	e.health = initialHealth;
	e.damage = (amt: number) => {
		e.health -= amt;
	};
	return e;
};

export interface Collectable extends Entity {
	collect: (item: Item, amount: number) => boolean;
}

export const Collectable: Component<Collectable, {}> = (base) => {
	// cast once to the widened type
	const e = base as Entity & Collectable;
	e.collect = (item: Item, amount: number): boolean => {
		// for (let i = 0; i < base.engine.player.Items.length; i++) {
		// 	const slot = base.engine.player.Items[i];
		// 	if (slot !== undefined) {
		// 		if (slot.item && slot.item.name === item.name) {
		// 			slot.count += amount;
		// 			base.engine.player.update({ Items: [...base.engine.player.Items] });
		// 			return true;
		// 		}
		// 	}
		// }

		// const findEmptySlot = (): number => {
		// 	for (let i = 0; i < base.engine.player.Items.length; i++) {
		// 		if (
		// 			base.engine.player.Items[i] === undefined ||
		// 			base.engine.player.Items[i].item.name === "none"
		// 		) {
		// 			return i;
		// 		}
		// 	}
		// 	return -1;
		// };

		// const emptyIdx = findEmptySlot();
		// if (emptyIdx === -1) {
		// 	return false;
		// }

		// base.engine.player.Items[emptyIdx] = {
		// 	count: amount,
		// 	item,
		// };
		base.engine.player.put({ count: amount, item: item });
		base.engine.player.update({ Items: [...base.engine.player.Items] });
		return true;
	};
	return e;
};

export interface Storeable extends Entity {
	store: () => Promise<void>;
	id: string;
	serialize: () => any;
	deserialize: (data: any) => void;
	sync: () => Promise<void>;
}

export const Storeable: Component<Storeable, string> = (base, init) => {
	let e = base as Entity & Storeable & Syncable;
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
	let entity: Entity = createEntity(e, tile.char, tile.fg, tile.bg);
	let builder = new EntityBuilder(entity);

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
		e.state.entities = e.state.entities.set(pos, entity);
		return builder.build();
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

	if (data.syncable && existingEntity?.syncable === undefined) {
		builder.add(Syncable, data.id);
	}

	if (data.id) {
		builder.add(Storeable, data.id);
	}

	const builtEntity = builder.build();

	if (existingEntity) {
		Object.assign(existingEntity, builtEntity);
		return existingEntity;
	}

	return builtEntity;
}
