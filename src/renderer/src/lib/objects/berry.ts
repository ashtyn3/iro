import type { Engine } from "..";
import { EntityBuilder } from "../entity";
import { createGObject } from "../object";
import { Collectable, Destructible } from "../traits";
import { Vec2d } from "../types";

export const Berry = (e: Engine, pos: Vec2d) => {
	const base = createGObject(e, "berry", Vec2d({ x: 1, y: 1 }), pos, ["o"]);

	const ext = new EntityBuilder(base)
		.add(Collectable, {})
		.add(Destructible, { maxHealth: 1, currentHealth: 1 })
		.build();

	return ext;
};
