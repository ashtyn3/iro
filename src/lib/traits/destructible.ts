import DeathView from "~/components/DeathView";
import type { Component } from "../comps";
import type { Syncable } from "../sync";
import type { Named } from ".";
import type { Entity, Existable } from "./types";

export interface Destructible extends Entity {
	health: number;
	damage(amount: number): void;
	dead: boolean;
}

export const Destructible: Component<Destructible, number> = (
	base,
	initialHealth,
) => {
	const e = base as Entity & Destructible & Syncable & Named;
	// cast once to the widened type
	// add your data & methods
	e.health = initialHealth;
	e.dead = false;
	e.damage = (amt: number) => {
		e.health -= amt;
		if (e.health <= 0) {
			e.dead = true;
			if (e.engine.menuHolder && e.name === "player") {
				e.engine.menuHolder.setMenu(() => DeathView({ engine: e.engine }));
				return e;
			}
		}
		if (e.update) {
			e.update({ health: e.health, dead: e.dead });
		}
	};
	return e;
};
