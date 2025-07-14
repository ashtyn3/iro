import type { Component } from "../comps";
import type { GObject } from "../object";
import type { Entity } from "./types";

export interface Boundary extends GObject {
	isBoundary: boolean;
}

export const Boundary: Component<Boundary, {}> = (base) => {
	const e = base as Entity & Boundary;
	e.isBoundary = true;
	return e;
};

export interface Trap extends GObject {
	isTrap: boolean;
	trapAction: () => void;
}

export const Trap: Component<
	Trap,
	{ kills: boolean; trapAction: () => void }
> = (base, init) => {
	const e = base as Entity & Trap;
	e.isTrap = true;
	e.trapAction = init.trapAction;
	return e;
};
