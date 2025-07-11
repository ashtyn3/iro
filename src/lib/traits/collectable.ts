import type { Component } from "../comps";
import type { Item } from "../inventory";
import type { Entity, Existable } from "./types";

export interface Collectable extends Entity {
	collect: (item: Item, amount: number) => boolean;
}

export const Collectable: Component<Collectable, {}> = (base) => {
	const e = base as Entity & Collectable;
	e.collect = (item: Item, amount: number): boolean => {
		base.engine.player.put({ count: amount, item: item });
		base.engine.player.update({ Items: [...base.engine.player.Items] });
		return true;
	};
	return e;
};
