import { EntityBuilder } from "~/lib/entity";
import {
	Destructible,
	Event,
	Renderable,
	secondsToFrames,
	Timed,
} from "~/lib/traits";
import { Pathed } from "~/lib/traits/pathed";
import type { Engine } from "../..";

// Use a fixed seek radius independent of view radius to avoid expensive A* over large areas
const DARK_THING_SEEK_RADIUS = 16;

import { createGObject, Unique } from "../../object";
import { Vec2d } from "../../types";

export const calcDistanceBtwVecs = (a: Vec2d, b: Vec2d) => {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.floor(Math.sqrt(dx * dx + dy * dy));
};
export const DarkThing = (e: Engine, pos: Vec2d) => {
	const base = createGObject(e, "dark_thing", Vec2d({ x: 1, y: 1 }), pos, [
		"z",
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
		.add(Pathed, {
			seeking: "player",
			maxDistance: DARK_THING_SEEK_RADIUS,
			minDistance: 1,
		})
		.add(Timed, events)
		.build();

	const ColorStates = {
		close: "#cccccc",
		far: "#888888",
	};
	ext.render = () => {
		const viewRadius = e.mapBuilder.VIEW_RADIUS;
		const distance = ext.distanceToPlayer();
		let color: string;
		if (distance > viewRadius) {
			return;
		} else if (distance > viewRadius / 2) {
			color = ColorStates.far;
		} else {
			color = ColorStates.close;
		}
		const vp = e.viewport();
		const px = ext.position.x - vp.x;
		const py = ext.position.y - vp.y;
		e.display.draw(px, py, ext.sprite[0], color, null);
	};

	return ext;
};
