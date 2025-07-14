import type { Component } from "../comps";
import { VIEWPORT } from "../map";
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
	inViewportWR: () => boolean;
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
	e.inViewportWR = () => {
		const lightSource = e.getLightSource();
		const viewport = e.engine.viewport();
		const lightX = lightSource.x;
		const lightY = lightSource.y;
		const lightRadius = lightSource.radius;

		const viewportRight = viewport.x + VIEWPORT.x;
		const viewportBottom = viewport.y + VIEWPORT.y;

		// Check if light could affect viewport area (including radius)
		if (
			lightX + lightRadius >= viewport.x &&
			lightX - lightRadius <= viewportRight &&
			lightY + lightRadius >= viewport.y &&
			lightY - lightRadius <= viewportBottom
		) {
			return true;
		}
		return false;
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
