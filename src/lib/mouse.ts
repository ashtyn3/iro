import * as Immutable from "immutable";
import type { Engine } from ".";
import type { Component } from "./comps";
import { EntityBuilder, EntityRegistry } from "./entity";
import { Vec2d } from "./state";
import { type Entity, Event, type Existable, Timed } from "./traits";

export interface MouseMove extends Existable {
	mousemove: (position: Vec2d) => void;
}

export const MouseMove: Component<
	MouseMove,
	{ mousemove: (position: Vec2d) => void }
> = (base, init) => {
	const e = base as Entity & MouseMove;
	e.mousemove = init.mousemove;
	return e;
};

export interface MouseMoveListener extends Existable {
	position: Vec2d;
	lastPosition: Vec2d;
}

export const createMouseMoveListener = (engine: Engine) => {
	const e: MouseMoveListener = {
		engine,
		_components: Immutable.Set(),
		position: Vec2d({ x: 0, y: 0 }),
		lastPosition: Vec2d({ x: 0, y: 0 }),
	};
	const built = new EntityBuilder(e).add(
		Timed,
		Event("mousemove", 1, () => {
			EntityRegistry.instance.lookup([MouseMove]).forEach((m) => {
				if (e.lastPosition.equals(e.position)) {
					return;
				}
				m.mousemove(e.position);
				e.lastPosition = e.position;
			});
		}),
	);
	const builtEntity = built.build();
	return builtEntity;
};
