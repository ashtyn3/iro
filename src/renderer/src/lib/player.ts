import type { Component } from "./comps";
import { createEntity, EntityBuilder, EntityRegistry } from "./entity";
import type { Engine } from "./index";
import { Inventory, type Item, Items } from "./inventory";
import { GMap } from "./map";
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
import { OrganicBody } from "./traits/sims/bodily_stress";
import { Vec2d } from "./types";

const timingChain = (e: Engine) =>
	Event("AirRadius", secondsToFrames(1), () => {
		if (e.player.air !== 0) {
			e.mapBuilder.VIEW_RADIUS = Math.floor(
				(e.player.air / 100) * GMap.VIEW_RADIUS_BASE,
			);
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
		})
		.and("organicBody", 1, () => {
			e.player.o2_supply = e.player.air;
			// Let F_cmd decay naturally instead of resetting to 0
			e.player.F_cmd = Math.max(0, e.player.F_cmd - 0.5); // Decay by 50 per frame
			e.player.tick(0.5);
			e.player.update({
				o2_supply: e.player.o2_supply,
				PCr: e.player.PCr,
				Lactate: e.player.Lactate,
				VO2: e.player.VO2,
				Glucose: e.player.Glucose,
				Temp: e.player.Temp,
				FatigueLevel: e.player.FatigueLevel,
				F: e.player.F,
				a_I: e.player.a_I,
				a_IIa: e.player.a_IIa,
				a_IIx: e.player.a_IIx,
			});
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
		.add(Destructible, {
			maxHealth: 20,
			currentHealth: 20,
		})
		.add(OrganicBody, {});
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
	Destructible &
	OrganicBody;

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
