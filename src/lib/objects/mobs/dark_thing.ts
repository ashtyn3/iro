import Msg from "~/components/Msg";
import { EntityBuilder, EntityRegistry } from "~/lib/entity";
import {
	Destructible,
	Event,
	Movable,
	Name,
	Named,
	Renderable,
	Storeable,
	secondsToFrames,
	Timed,
} from "~/lib/traits";
import { Pathed } from "~/lib/traits/pathed";
import type { Engine } from "../..";
import { GMap } from "../../map";
import { createGObject, Unique } from "../../object";
import { Vec2d } from "../../state";

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
			maxDistance: GMap.VIEW_RADIUS_BASE,
			minDistance: 1,
			passable: (x, y) => {
				const target = EntityRegistry.instance.lookupAndQuery(
					[Movable, Name("fire")],
					(e) => {
						const distance = calcDistanceBtwVecs(Vec2d({ x, y }), e.position);
						if (distance > GMap.VIEW_RADIUS_BASE - 2) {
							return false;
						}
						return true;
					},
				);
				return target.length === 0;
			},
		})
		.add(Timed, events)
		.build();

	const ColorStates = {
		close: "#cccccc", // Brightest when close
		far: "#888888", // Medium at mid distance
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
