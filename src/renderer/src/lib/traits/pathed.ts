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
		if (distance > maxDistance) {
			// Greedy step towards the target to close distance without expensive A*
			let bestStep: Vec2d | null = null;
			let bestScore = Number.POSITIVE_INFINITY;
			for (let ox = -1; ox <= 1; ox++) {
				for (let oy = -1; oy <= 1; oy++) {
					if (ox === 0 && oy === 0) continue;
					const nx = e.position.x + ox;
					const ny = e.position.y + oy;
					if (nx < 0 || ny < 0 || nx >= e.engine.width || ny >= e.engine.height)
						continue;
					const tile = e.engine.mapBuilder.tiles[nx]?.[ny];
					if (!tile || tile.boundary) continue;
					const ddx = target.position.x - nx;
					const ddy = target.position.y - ny;
					const score = ddx * ddx + ddy * ddy; // squared distance
					if (score < bestScore) {
						bestScore = score;
						bestStep = Vec2d({ x: ox, y: oy });
					}
				}
			}
			if (bestStep) {
				e.move(bestStep);
			}
			return;
		}

		if (dx === 0 && dy === 0) {
			return;
		}

		const isPassable = (x: number, y: number) => {
			if (x < 0 || y < 0 || x >= e.engine.width || y >= e.engine.height) {
				return false;
			}
			// Bound search: allow nodes that are within the box around either the target OR the seeker.
			// This keeps A* reasonable while still permitting necessary detours.
			const outOfTargetBox =
				Math.abs(x - target.position.x) > maxDistance ||
				Math.abs(y - target.position.y) > maxDistance;
			const outOfSeekerBox =
				Math.abs(x - e.position.x) > maxDistance ||
				Math.abs(y - e.position.y) > maxDistance;
			if (outOfTargetBox && outOfSeekerBox) {
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

		let nextStep: Vec2d | undefined;
		pathfinder.compute(e.position.x, e.position.y, (x, y) => {
			if (
				nextStep === undefined &&
				(x !== e.position.x || y !== e.position.y)
			) {
				nextStep = Vec2d({ x, y });
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
