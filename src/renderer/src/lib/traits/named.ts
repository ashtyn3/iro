import type { Component } from "../comps";
import type { Entity, Existable } from "./types";

export interface Named extends Existable {
	name: string;
}

export const Named: Component<Named, { name: string }> = (base, init) => {
	const e = base as Entity & Named;
	e.name = init.name;
	e._components = e._components.add(Symbol.for(e.name));
	return e;
};

export const Name = (name: string) => {
	const fn = (base: any, p: any) => {
		// Component implementation
		const e = base as Entity & Named;
		e.name = p.name;
		e._components = e._components.add(Symbol.for(e.name));
		return e;
	};
	Object.defineProperty(fn, "name", {
		value: name,
		writable: false,
		enumerable: false,
		configurable: true,
	});
	return fn as Component<Named, { name: string }>;
};
