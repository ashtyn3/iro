import DeathView from "~/components/DeathView";
import type { Component } from "./comps";
import { createEntity, EntityBuilder, EntityRegistry } from "./entity";
import type { Engine } from "./index";
import { Inventory, type Item, Items } from "./inventory";
import { Vec2d } from "./state";
import { Syncable } from "./sync";
import type { Entity } from "./traits";
import {
	Destructible,
	Event,
	Movable,
	Named,
	Renderable,
	Storeable,
	secondsToFrames,
	Timed,
} from "./traits";
import { Trap } from "./traits/object_props";

const timingChain = (e: Engine) =>
	Event("AirRadius", secondsToFrames(1), () => {
		if (e.player.air !== 0) {
			e.mapBuilder.VIEW_RADIUS = Math.floor((e.player.air / 100) * 10);
		}

		if (e.player.air === 0) {
			e.mapBuilder.VIEW_RADIUS = 0;
		}
		EntityRegistry.instance.lookupAndQuery([Trap, Movable], (t) => {
			if (t.position.equals(e.player.position)) {
				t.trapAction();
			}
		});
	})
		.and("AirReduce", secondsToFrames(4), () => {
			if (e.player.air !== 0) {
				e.player.air -= 10;
				e.player.update({ air: e.player.air });
			}
		})
		.and("HealthChanger", secondsToFrames(2), () => {
			if (e.player.air === 0) {
				e.player.damage(4);
			}
			if (e.player.air > 60 && e.player.health <= 10) {
				e.player.health += 1;
				e.player.update({ health: e.player.health });
			}
		})
		.and("AirFlicker1", 15, () => {
			if (e.player.air === 0) {
				e.mapBuilder.VIEW_RADIUS = e.mapBuilder.VIEW_RADIUS === 1 ? 0 : 1;
			}
		})
		.and("AirFlicker2", 20, () => {
			if (e.player.air === 0) {
				e.mapBuilder.VIEW_RADIUS = e.mapBuilder.VIEW_RADIUS === 1 ? 0 : 1;
			}
		});
const playerBuilder = (e: Engine, char: string, dominant: "left" | "right") => {
	return new EntityBuilder(createEntity(e, char))
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
		.add(Renderable, () => {})
		.add(Timed, timingChain(e))
		.add(Named, { name: "player" })
		.add(Destructible, 20);
};

export type PlayerType = Entity &
	Movable &
	Inventory &
	Air &
	Syncable &
	Storeable &
	Renderable &
	Timed &
	Named &
	Destructible;

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
	e.air = 100;
	return e;
};
