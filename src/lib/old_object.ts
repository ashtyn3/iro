import { createEntity, createEntity } from "./entity";
import type { Engine } from "./index";
import type { Vec2d } from "./state";
import type { Entity, Movable } from "./traits";
import { Movable as MovableTrait } from "./traits";

export interface Gobject extends Entity, Movable {
	parts: Array<Entity>;
}

export function createGobject(
	e: Engine,
	name: string,
	ps: Array<Entity>,
	tl_pos: Vec2d,
): Gobject {
	const entity = createEntity(e, name);
	const movable = Movable(entity, tl_pos);

	const gobject = movable as Gobject;
	gobject.parts = ps;

	gobject.move = (delta: Vec2d): void => {
		if (
			e.mapBuilder.tiles[gobject.position.x + delta.x][
				gobject.position.y + delta.y
			].boundary
		)
			return;
		gobject.parts.forEach((p) => {
			if (p.move) p.move(delta);
		});
	};

	return gobject;
}

export function box(
	e: Engine,
	size: Vec2d,
	tl_pos: Vec2d,
	border: { h: string; v: string },
	fill: string | null,
) {
	const parts: Entity[] = [];

	const x0 = tl_pos.x - 1;
	const x1 = tl_pos.x + size.x;
	const y0 = tl_pos.y - 1;
	const y1 = tl_pos.y + size.y;

	parts.push(new Entity(e, { x: x0, y: y0 }, "┌"));
	parts.push(new Entity(e, { x: x1, y: y0 }, "┐"));
	parts.push(new Entity(e, { x: x0, y: y1 }, "└"));
	parts.push(new Entity(e, { x: x1, y: y1 }, "┘"));


	for (let dx = 0; dx < size.x; dx++) {
		parts.push(new Entity(e, { x: tl_pos.x + dx, y: y0 }, border.h));
		parts.push(new Entity(e, { x: tl_pos.x + dx, y: y1 }, border.h));
	}


	for (let dy = 0; dy < size.y; dy++) {
		parts.push(new Entity(e, { x: x0, y: tl_pos.y + dy }, border.v));
		parts.push(new Entity(e, { x: x1, y: tl_pos.y + dy }, border.v));
	}
	if (fill !== null) {
		for (let dy = 0; dy < size.y; dy++) {
			for (let dx = 0; dx < size.x; dx++) {
				parts.push(new Entity(e, { x: tl_pos.x + dx, y: tl_pos.y + dy }, fill));
			}
		}
	}

	return new Gobject(e, "box", parts, tl_pos);
}
