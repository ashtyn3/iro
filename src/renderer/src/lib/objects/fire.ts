import Msg from "~/components/Msg";
import type { Engine } from "..";
import { EntityBuilder } from "../entity";
import { createGObject, type GObjectBase } from "../object";
import {
	Event,
	type Existable,
	LightEmitter,
	type Movable,
	Renderable,
	Timed,
} from "../traits";
import { Trap } from "../traits/object_props";
import { Vec2d } from "../types";

export const Fire = (e: Engine, pos: Vec2d) => {
	const base = createGObject(e, "fire", Vec2d({ x: 1, y: 1 }), pos, ["*"]);

	const fireEvents = Event("fire", 15, () => {
		if (ext.fg === "red") {
			ext.fg = "yellow";
			ext.bg = "red";
		} else if (ext.fg === "yellow") {
			ext.fg = "red";
			ext.bg = "yellow";
		}
	});

	const ext = new EntityBuilder(base)
		.add(Timed, fireEvents)
		.add(Renderable, () => {})
		.add(LightEmitter, {
			radius: 15,
			color: "#FF6B35",
			intensity: 0.8,
			neutralPercentage: 0.4,
		})
		.add(Trap, () => {
			e.player.damage(1);
			e.messageMenu.setMenu(() =>
				Msg({ engine: e, msg: "You are burning..." }),
			);
		})
		.build();

	ext.fg = "red";
	ext.bg = "yellow";

	ext.render = () => {
		if (!ext.inViewportWR()) {
			return;
		}
		const vp = e.viewport();
		const px = ext.position.x - vp.x;
		const py = ext.position.y - vp.y;
		e.display.draw(px, py, ext.sprite[0], ext.fg, ext.bg);
	};
	return ext;
};
