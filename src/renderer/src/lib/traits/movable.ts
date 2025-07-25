import type { Component } from "../comps";
import { Vec2d } from "../types";
import type { Entity } from "./types";

export interface Movable extends Entity {
	position: Vec2d;
	move: (delta: Vec2d) => void;
}

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
