import type { Component } from "./comps";
import { createEntity, EntityBuilder } from "./entity";
import type { Engine } from "./index";
import { Inventory, type Item, Items } from "./inventory";
import { Vec2d } from "./state";
import { Syncable } from "./sync";
import type { Entity } from "./traits";
import { Movable, Renderable, Storeable } from "./traits";

const playerBuilder = (e: Engine, char: string, dominant: "left" | "right") =>
	new EntityBuilder(createEntity(e, char))
		.add(Movable, Vec2d({ x: 4, y: 10 }))
		.add(Inventory, {
			slots: 6,
			dominant: dominant,
			Items: [
				{ count: 1, item: Items.pickaxe },
				{ count: 1, item: Items.o2 },
				{ count: 0, item: Items.empty },
				{ count: 0, item: Items.empty },
				{ count: 0, item: Items.empty },
				{ count: 0, item: Items.empty },
			],
		})
		.add(Air, {})
		.add(Syncable, "player")
		.add(Storeable, "player")
		.add(Renderable, () => {});

export type PlayerType = ReturnType<ReturnType<typeof playerBuilder>["build"]>;

export const Player = (
	e: Engine,
	char: string,
	dominant: "left" | "right",
): PlayerType => {
	const built = playerBuilder(e, char, dominant).build();
	built.render = () => {
		const vp = e.viewport();
		const px = built.position.x - vp.x;
		const py = built.position.y - vp.y;
		e.display.drawOver(px, py, built.char, "#FFF", null);
	};
	return built;
};

export interface Air extends Entity {
	air: number;
}

export const Air: Component<Air, {}> = (base, init) => {
	const e = base as Entity & Air;
	e.air = 0;
	return e;
};
