// entity.ts

import * as immutable from "immutable";
import SuperJSON from "superjson";
import {
	type AddedOf,
	applyMixins,
	type Component,
	type ParamsOf,
	type UnionToIntersection,
} from "./comps";
import type { Engine } from "./index";
import { Inventory, MenuHolder } from "./inventory";
import { TileKinds } from "./map";
import { Unique } from "./object";
import { Berry } from "./objects/berry";
import { Fire } from "./objects/fire";
import { DarkThing } from "./objects/mobs/dark_thing";
import { Air, Player } from "./player";
import { Vec2d } from "./state";
import { Syncable } from "./sync";
import {
	Collectable,
	Destructible,
	type Entity,
	type Existable,
	Movable,
	Named,
	Storeable,
	Timed,
} from "./traits";
import { LightEmitter } from "./traits/lightEmitter";
import { Boundary, Trap } from "./traits/object_props";
import { Pathed } from "./traits/pathed";
import { Renderable } from "./traits/renderable";

export type EntityTypes = "norm" | "destructable" | "collectable";

export class EntityRegistry {
	static instance: EntityRegistry = new EntityRegistry();

	private CtoE: immutable.Map<immutable.Set<symbol>, Entity> = immutable.Map();

	register(entity: Entity) {
		this.CtoE = this.CtoE.set(entity._components, entity);
	}

	lookup<M extends Array<Component<any, any>>>(
		components: M,
	): Array<UnionToIntersection<AddedOf<M[number]>>> {
		const s = immutable.Set(components.map((c) => Symbol.for(c.name)));
		const matching = this.CtoE.filter((e) => {
			return s.isSubset(e._components);
		}).valueSeq();
		return matching.toArray() as any;
	}
	singleLookup<M extends Array<Component<any, any>>>(
		components: M,
	): UnionToIntersection<AddedOf<M[number]>> | undefined {
		return this.CtoE.filter((e) => {
			return components.every((c) => e._components.has(Symbol.for(c.name)));
		}).first() as any;
	}
	lookupAndQuery<M extends Array<Component<any, any>>>(
		components: M,
		query: (entity: UnionToIntersection<AddedOf<M[number]>>) => any,
	): UnionToIntersection<AddedOf<M[number]>>[] {
		const entities = this.lookup(components);
		return entities.filter((e) => query(e as any)) as any;
	}

	deleteAndQuery<M extends Array<Component<any, any>>>(
		components: M,
		query: (entity: UnionToIntersection<AddedOf<M[number]>>) => any,
	) {
		const entities = this.lookupAndQuery(components, query);
		entities.forEach((e) => {
			this.CtoE = this.CtoE.delete((e as any)._components);
		});
	}

	lookupByName(name: string) {
		return this.CtoE.filter((e) => {
			return e._components.has(Symbol.for(name));
		}).first();
	}
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
		_components: immutable.Set(),
	};
}

export class EntityBuilder<
	B extends Existable = Existable,
	M extends Array<Component<any, any>> = [],
> {
	private entries: Array<[Component<any, any>, any]>;

	constructor(
		private base: B,
		entries?: Array<[Component<any, any>, any]>,
	) {
		this.entries = entries ?? [];
	}

	add<Mi extends Component<any, any>>(
		fn: Mi,
		params: ParamsOf<Mi>,
	): EntityBuilder<B, [...M, Mi]> {
		const nextEntries = [...this.entries, [fn, params]] as Array<
			[Component<any, any>, any]
		>;
		this.entries = nextEntries;

		return this as unknown as EntityBuilder<B, [...M, Mi]>;
	}

	build(): B & UnionToIntersection<AddedOf<M[number]>> {
		const entity = applyMixins(this.base, ...this.entries) as any;
		EntityRegistry.instance.register(entity);
		return entity;
	}
}

// Custom serializer for component sets that contain symbols
SuperJSON.registerCustom(
	{
		serialize: (set: immutable.Set<symbol>) => {
			// Convert symbols to their string keys for serialization
			return set.toArray().map((sym) => {
				const key = Symbol.keyFor(sym);
				if (key !== undefined) return key;
				// For symbols without keys, use the description or a fallback
				return sym.description || `Symbol_${sym.toString().slice(7, -1)}`;
			});
		},
		deserialize: (arr: string[]) => {
			// Convert string keys back to symbols
			return immutable.Set(
				arr.map((key) => {
					// Handle empty string keys by using a fallback
					if (key === "") return Symbol.for("unnamed");
					return Symbol.for(key);
				}),
			);
		},
		isApplicable: (v: any): v is immutable.Set<symbol> => {
			if (!(v instanceof immutable.Set)) return false;
			try {
				const arr = (v as any).toArray();
				return (
					arr.length > 0 && arr.every((item: any) => typeof item === "symbol")
				);
			} catch {
				return false;
			}
		},
	},
	"immutable.Set<symbol>",
);

// Keep the general immutable.Set serializer for other sets
SuperJSON.registerCustom(
	{
		serialize: (set: immutable.Set<any>) => set.toArray(),
		deserialize: (arr: any) => immutable.Set(arr),
		isApplicable: (v: any): v is immutable.Set<unknown> => {
			if (!(v instanceof immutable.Set)) return false;
			try {
				const arr = (v as any).toArray();
				return (
					arr.length === 0 ||
					!arr.every((item: any) => typeof item === "symbol")
				);
			} catch {
				return true; // If we can't check, assume it's a regular set
			}
		},
	},
	"immutable.Set",
);

// Custom serializer for Vec2d immutable records
SuperJSON.registerCustom(
	{
		serialize: (vec2d: any) => {
			// Convert Vec2d to plain object for serialization
			return { x: vec2d.x, y: vec2d.y };
		},
		deserialize: (data: any) => {
			// Convert plain object back to Vec2d
			return Vec2d(data);
		},
		isApplicable: (v: any): v is any => {
			// Check if this is a Vec2d (has x, y properties and is an immutable record)
			// Use a more reliable check that works with minification
			return (
				v &&
				typeof v === "object" &&
				"x" in v &&
				"y" in v &&
				typeof v.x === "number" &&
				typeof v.y === "number" &&
				v.constructor &&
				typeof v.constructor === "function" &&
				typeof v.equals === "function"
			);
		},
	},
	"Vec2d",
);

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
					builder.add(Destructible, {
						maxHealth: 15,
						currentHealth: 15,
					});
					break;
			}
		});
	};
	builder.add(Movable, Vec2d(pos));
	if (tile.mask) {
		if (tile.mask.kind === TileKinds.berry) {
			return Berry(e, pos);
		} else {
			if (tile.mask.promotable) {
				make_entity(tile.mask.promotable.type);
			} else if (tile.promotable) {
				make_entity(tile.promotable.type);
			}
			const builtEntity = builder.build() as Entity;
			return builtEntity;
		}
	}
	return entity;
}

// Component mapping for deserialization
const COMPONENT_MAP: Record<
	string,
	{ component: any; getParams: (data: any) => any }
> = {
	Movable: {
		component: Movable,
		getParams: (data: any) =>
			data.position ? Vec2d(data.position) : Vec2d({ x: 0, y: 0 }),
	},
	Destructible: {
		component: Destructible,
		getParams: (data: any) => ({
			maxHealth: data.maxHealth || 15,
			currentHealth: data.health || 15,
		}),
	},
	Timed: {
		component: Timed,
		getParams: (data: any) => data.act,
	},
	Inventory: {
		component: Inventory,
		getParams: (data: any) => ({
			slots: data.slots || 5,
			dominant: data.dominant || "right",
			Items: data.Items || [],
			hands: data.hands || [],
		}),
	},
	Air: {
		component: Air,
		getParams: () => ({}),
	},
	Syncable: {
		component: Syncable,
		getParams: (data: any) => data.id || "",
	},
	Named: {
		component: Named,
		getParams: (data: any) => ({ name: data.name }),
	},
	Pathed: {
		component: Pathed,
		getParams: (data: any) => data.seeking || "",
	},
	Storeable: {
		component: Storeable,
		getParams: (data: any) => data.id || "",
	},
	Collectable: {
		component: Collectable,
		getParams: () => ({}),
	},
	LightEmitter: {
		component: LightEmitter,
		getParams: (data: any) => ({
			radius: data.lightRadius || 3,
			color: data.lightColor || "#FFFFFF",
			intensity: data.lightIntensity || 1.0,
			neutralPercentage: data.lightNeutralPercentage ?? 0,
		}),
	},
	Boundary: {
		component: Boundary,
		getParams: () => ({}),
	},
	Trap: {
		component: Trap,
		getParams: (data: any) => data.trapFunction || (() => {}),
	},
	Renderable: {
		component: Renderable,
		getParams: (data: any) => data.renderFunction || (() => {}),
	},
	Unique: {
		component: Unique,
		getParams: () => ({}),
	},
	MenuHolder: {
		component: MenuHolder,
		getParams: (data: any) => ({ menu: data.menuFunction || (() => null) }),
	},
};

export function deserializeEntity(
	engine: Engine,
	data: any,
	existingEntity?: Entity,
): Entity {
	// For known entity types, try to find existing entity in registry
	if (data.name === "player") {
		const existingPlayer = EntityRegistry.instance.lookupByName("player");
		if (existingPlayer) {
			// Update existing player entity with new data
			Object.assign(existingPlayer, data);
			return existingPlayer;
		} else {
			// Create new player if none exists
			return Player(engine, data.char || "@", data.dominant || "right");
		}
	} else if (data.name === "fire") {
		const existingFire = EntityRegistry.instance.lookupByName("fire");
		if (existingFire) {
			// Update existing fire entity
			Object.assign(existingFire, data);
			return existingFire;
		} else {
			// Create new fire entity
			return Fire(engine, data.position);
		}
	} else if (data.name === "dark_thing") {
		const existingDarkThing =
			EntityRegistry.instance.lookupByName("dark_thing");
		if (existingDarkThing) {
			// Update existing dark thing entity
			Object.assign(existingDarkThing, data);
			return existingDarkThing;
		} else {
			// Create new dark thing entity
			return DarkThing(engine, data.position);
		}
	}

	const entityToBuildOn =
		existingEntity ?? createEntity(engine, data.char, data.fg, data.bg);
	const builder = new EntityBuilder(entityToBuildOn);

	data._components.forEach((component: any) => {
		let componentName: string;
		if (typeof component === "symbol") {
			const key = Symbol.keyFor(component);
			if (key !== undefined) {
				componentName = key;
			} else {
				componentName =
					component.description ||
					`Symbol_${component.toString().slice(7, -1)}`;
			}
		} else {
			componentName = component;
		}

		const componentInfo = COMPONENT_MAP[componentName];
		if (componentInfo) {
			const params = componentInfo.getParams(data);
			if (params !== undefined) {
				builder.add(componentInfo.component, params);
			}
		} else {
			if (data.name === componentName) {
				builder.add(Named, { name: data.name });
			} else {
				console.warn(
					`Unknown component during deserialization: ${componentName}`,
				);
			}
		}
	});

	const builtEntity = builder.build() as Entity;

	if (existingEntity) {
		Object.assign(existingEntity, builtEntity);
		return existingEntity;
	}

	return builtEntity;
}
export type { Entity };
