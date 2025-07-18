import immutable from "immutable";
import SuperJSON from "superjson";
import DeathView from "~/components/DeathView";
import type { Component } from "../comps";
import type { Syncable } from "../sync";
import type { Named } from ".";
import type { Entity, Existable } from "./types";

export interface Destructible extends Entity {
	health: number;
	maxHealth: number;
	damage(amount: number): void;
	heal(amount: number): void;
	dead: boolean;
}

export const Destructible: Component<
	Destructible,
	{ maxHealth: number; currentHealth: number }
> = (base, { maxHealth, currentHealth }) => {
	const e = base as Entity & Destructible & Syncable & Named;

	e.maxHealth = maxHealth;
	e.health = currentHealth;
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
	e.heal = (amt: number) => {
		e.health += amt;
		if (e.health > e.maxHealth) {
			e.health = e.maxHealth;
		}
		if (e.update) {
			e.update({ health: e.health, dead: e.dead });
		}
	};
	return e;
};
