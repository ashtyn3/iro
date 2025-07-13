import type { Component } from "../comps";
import type { Entity, Existable } from "./types";

export interface LightSource {
	x: number;
	y: number;
	radius: number;
	color: string;
	intensity: number;
}

export interface LightEmitter extends Existable {
	lightRadius: number;
	lightColor: string;
	lightIntensity: number;
	getLightSource: () => LightSource;
}

export const LightEmitter: Component<
	LightEmitter,
	{ radius: number; color: string; intensity: number }
> = (base, init) => {
	const e = base as Entity & LightEmitter;
	e.lightRadius = init.radius;
	e.lightColor = init.color;
	e.lightIntensity = init.intensity;

	e.getLightSource = (): LightSource => {
		const position = (e as any).position;
		if (!position) {
			throw new Error(
				"LightEmitter requires entity to have Movable trait (position)",
			);
		}
		return {
			x: position.x,
			y: position.y,
			radius: e.lightRadius,
			color: e.lightColor,
			intensity: e.lightIntensity,
		};
	};

	return e;
};

// Set the name property for the component function
Object.defineProperty(LightEmitter, "name", {
	value: "LightEmitter",
	writable: false,
	enumerable: false,
	configurable: true,
});
