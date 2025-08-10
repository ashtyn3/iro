import type { Engine } from "..";
import type { Component } from "../comps";
import { EntityRegistry } from "../entity";
import { TileKinds } from "../map";
import type { Wall } from "../object";
import { Vec2d } from "../types";
import type { Entity } from "./types";

export interface Movable extends Entity {
	position: Vec2d;
	move: (delta: Vec2d) => void;
}

// export const getEntityAtPosition = (e: Engine, position: Vec2d) => {
// 	const entity = EntityRegistry.instance.lookupAndQuery([Movable], (entity) =>
// 		entity.position.equals(position),
// 	);
// 	return entity.length > 0 ? entity[0] : null;
// };
export const getClusterAtPosition = (e: Engine, position: Vec2d) => {
	const cluster = e.mapBuilder.getClusterAt(position);
	return cluster;
};

export const Movable: Component<Movable, Vec2d> = (base, init) => {
	const e = base as Entity & Movable;

	e.position = init;
	e.move = (delta: Vec2d): void => {
		const newX = e.position.x + delta.x;
		const newY = e.position.y + delta.y;

		const oldPositionKey = e.position;
		const newPositionKey = Vec2d({ x: newX, y: newY });

		if (
			newY >= e.engine.height ||
			newX >= e.engine.width ||
			newX < 0 ||
			newY < 0
		)
			return;
		if (e.engine.mapBuilder.tiles[newX][newY].boundary) return;
		const newPositionCluster = getClusterAtPosition(e.engine, newPositionKey);
		if (newPositionCluster) {
			if (newPositionCluster.kind === TileKinds.struct) {
				return;
			}
		}
		// const newPositionEntity = getEntityAtPosition(
		// 	e.engine,
		// 	newPositionKey,
		// ) as Movable & Wall;
		// if (newPositionEntity) {
		// 	if (newPositionEntity.wall) {
		// 		return;
		// 	}
		// }

		if (oldPositionKey.equals(newPositionKey)) {
			return;
		}

		e.position = newPositionKey;
	};

	return e;
};

Object.defineProperty(Movable, "name", {
	value: "Movable",
	writable: false,
	enumerable: false,
	configurable: true,
});
