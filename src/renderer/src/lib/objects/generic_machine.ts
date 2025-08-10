import type { Engine } from "..";
import { EntityBuilder } from "../entity";
import { type Cluster, TileKinds } from "../map";
import { createGObject, Wall } from "../object";
import { Syncable } from "../sync";
import { Event, Renderable, secondsToFrames, Timed } from "../traits";
import type { Vec2d } from "../types";

type BoxCharacters = {
	corners: {
		topLeft: string;
		topRight: string;
		bottomLeft: string;
		bottomRight: string;
	};
	horizontal: string;
	vertical: string;
	center: string;
	centerFill?: boolean;
};

export const GenericMachine = (
	engine: Engine,
	pos: Vec2d,
	size: Vec2d,
	box: BoxCharacters,
) => {
	const { corners, horizontal, vertical, center } = box;
	const base = createGObject(engine, "generic_machine", size, pos, [
		box.center,
	]);

	const ext = new EntityBuilder(base)
		.add(
			Timed,
			Event("generic_machine", secondsToFrames(1), () => {
				console.log("generic_machine");
			}),
		)
		.add(Wall, {})
		.add(Renderable, () => {});

	const built = ext.build();
	const cluster: Cluster = {
		kind: TileKinds.struct,
		center: { x: 0, y: 0 },
		points: [],
	};
	for (let i = 0; i < size.x; i++) {
		for (let j = 0; j < size.y; j++) {
			cluster.points.push({ x: built.position.x + i, y: built.position.y + j });
		}
	}
	cluster.center = {
		x: Math.floor(size.x / 2),
		y: Math.floor(size.y / 2),
	};
	engine.mapBuilder.addCluster(cluster);
	built.render = () => {
		if (!built.inViewport()) {
			return;
		}
		const centerX = Math.floor(size.x / 2);
		const centerY = Math.floor(size.y / 2);
		const centerFill = box.centerFill === true;

		for (let i = 0; i < size.x; i++) {
			for (let j = 0; j < size.y; j++) {
				let char: string | null = null;

				// Corners
				if (i === 0 && j === 0) {
					char = corners.topLeft;
				} else if (i === size.x - 1 && j === 0) {
					char = corners.topRight;
				} else if (i === 0 && j === size.y - 1) {
					char = corners.bottomLeft;
				} else if (i === size.x - 1 && j === size.y - 1) {
					char = corners.bottomRight;
				}
				// Edges
				else if (j === 0 || j === size.y - 1) {
					char = horizontal;
				} else if (i === 0 || i === size.x - 1) {
					char = vertical;
				}
				// Center area
				else if (centerFill) {
					char = center;
				} else if (i === centerX && j === centerY) {
					char = center;
				}

				if (char) {
					const vp = engine.viewport();
					const drawX = built.position.x + i - vp.x;
					const drawY = built.position.y + j - vp.y;
					engine.display.drawOver(drawX, drawY, char, "white", "");
				}
			}
		}
	};
	return built;
};
