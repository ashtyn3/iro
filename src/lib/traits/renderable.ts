import type { Component } from "../comps";
import type { Entity, Existable } from "./types";

export interface Renderable extends Existable {
	render: () => void;
}

export const Renderable: Component<Renderable, () => void> = (base, render) => {
	const e = base as Entity & Renderable;
	e.render = render;
	return e;
};

// Set the name property for the component function
Object.defineProperty(Renderable, "name", {
	value: "Renderable",
	writable: false,
	enumerable: false,
	configurable: true,
});
