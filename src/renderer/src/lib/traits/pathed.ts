import * as ROT from "rot-js";
import type { Component } from "../comps";
import { type Entity, EntityRegistry } from "../entity";
import { Vec2d } from "../types";
import { Movable, Name } from ".";

export interface Pathed extends Entity {
	seek: () => void;
	seeking: string;
	distanceToPlayer: () => number;
}

export const Pathed: Component<
	Pathed,
	{
		seeking: string;
		maxDistance: number;
		minDistance: number;
		passable?: (x: number, y: number) => boolean;
	}
> = (base, { seeking, maxDistance, minDistance, passable }) => {
	const e = base as Entity & Pathed & Movable;
	e.distanceToPlayer = () => {
		const target = EntityRegistry.instance.singleLookup([
			Name(seeking),
			Movable,
		]);
		if (!target) {
			return 0;
		}
		const dx = target.position.x - e.position.x;
		const dy = target.position.y - e.position.y;
		return Math.sqrt(dx * dx + dy * dy);
	};
	e.seek = () => {
		const target = EntityRegistry.instance.singleLookup([
			Name(seeking),
			Movable,
		]);
		if (!target) {
			return;
		}

		const dx = target.position.x - e.position.x;
		const dy = target.position.y - e.position.y;
		const distance = Math.floor(Math.sqrt(dx * dx + dy * dy));
		if (distance <= minDistance) {
			return;
		}
		if (distance >= maxDistance) {
			return;
		}

		if (dx === 0 && dy === 0) {
			return;
		}

		const isPassable = (x: number, y: number) => {
			if (x < 0 || y < 0 || x >= e.engine.width || y >= e.engine.height) {
				return false;
			}
			const tile = e.engine.mapBuilder.tiles[x]?.[y];
			return tile && !tile.boundary && (!passable || passable(x, y));
		};

		const pathfinder = new ROT.Path.AStar(
			target.position.x,
			target.position.y,
			isPassable,
			{ topology: 8 },
		);

		let nextStep: { x: number; y: number } | undefined;
		pathfinder.compute(e.position.x, e.position.y, (x, y) => {
			if (
				nextStep === undefined &&
				(x !== e.position.x || y !== e.position.y)
			) {
				nextStep = { x, y };
			}
		});

		if (nextStep !== undefined) {
			const moveX = nextStep.x - e.position.x;
			const moveY = nextStep.y - e.position.y;
			e.move(Vec2d({ x: moveX, y: moveY }));
		}
	};
	return e;
};
