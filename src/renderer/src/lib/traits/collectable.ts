import type { Component } from "../comps";
import { EntityRegistry } from "../entity";
import { Inventory, type Item } from "../inventory";
import { Syncable } from "../sync";
import type { Entity, Existable } from "./types";

export interface Collectable extends Entity {
	collect: (item: Item, amount: number) => boolean;
}

export const Collectable: Component<Collectable, {}> = (base) => {
	const e = base as Entity & Collectable;
	e.collect = (item: Item, amount: number): boolean => {
		const inventory = EntityRegistry.instance.singleLookup([
			Inventory,
			Syncable,
		]);
		if (!inventory) {
			return false;
		}
		inventory.put({ count: amount, item: item });
		inventory.update({ Items: [...inventory.Items] });
		return true;
	};
	return e;
};
