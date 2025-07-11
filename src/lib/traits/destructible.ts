import type { Component } from "../comps";
import type { Entity, Existable } from "./types";

export interface Destructible extends Entity {
	health: number;
	damage(amount: number): void;
}

export const Destructible: Component<Destructible, number> = (
	base,
	initialHealth,
) => {
	const e = base as Entity & Destructible;
	// cast once to the widened type
	// add your data & methods
	e.health = initialHealth;
	e.damage = (amt: number) => {
		e.health -= amt;
	};
	return e;
};
