import type { Engine } from "..";
import { EntityBuilder } from "../entity";
import { createGObject } from "../object";
import { Vec2d } from "../state";
import { Collectable, Destructible, Renderable } from "../traits";

export const Berry = (e: Engine, pos: Vec2d) => {
	const base = createGObject(e, "berry", Vec2d({ x: 1, y: 1 }), pos, ["o"]);

	const ext = new EntityBuilder(base)
		.add(Collectable, {})
		.add(Destructible, 1)
		.build();

	return ext;
};
