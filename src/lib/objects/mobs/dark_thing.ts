import { EntityBuilder } from "~/lib/entity";
import {
	Destructible,
	Event,
	Renderable,
	Storeable,
	secondsToFrames,
	Timed,
} from "~/lib/traits";
import { Pathed } from "~/lib/traits/pathed";
import type { Engine } from "../..";
import { createGObject, Unique } from "../../object";
import { Vec2d } from "../../state";

export const DarkThing = (e: Engine, pos: Vec2d) => {
	const base = createGObject(e, "dark_thing", Vec2d({ x: 1, y: 1 }), pos, [
		"o",
	]);

	const events = Event("path_find", secondsToFrames(0.3), () => {
		ext.seek();
	});
	const ext = new EntityBuilder(base)
		.add(Destructible, {
			maxHealth: 10,
			currentHealth: 10,
		})
		.add(Renderable, () => {})
		.add(Unique, {})
		.add(Pathed, "player")
		.add(Timed, events)
		.build();

	ext.render = () => {
		const vp = e.viewport();
		const px = ext.position.x - vp.x;
		const py = ext.position.y - vp.y;
		e.display.draw(px, py, "X", "#444444", null);
	};

	return ext;
};
