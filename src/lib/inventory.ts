import * as immutable from "immutable";
import type { JSX } from "solid-js";
import Msg from "~/components/Msg";
import type { Act } from "./action";
import type { Component } from "./comps";
import { EntityBuilder, EntityRegistry, promote } from "./entity";
import type { Engine } from "./index";
import { TileKinds, VIEWPORT } from "./map";
import type { Air } from "./player";
import { DB, Vec2d } from "./state";
import { Syncable } from "./sync";
import {
	Collectable,
	Destructible,
	type Entity,
	type Existable,
	Movable,
	type Renderable,
} from "./traits";

export interface Item extends Act {
	name: string;
	sprite: string[];
	usable: boolean;
}

export const assetPath = async (name: string) => {
	return (await import(`~/lib/assets/${name}.png`)).default;
};
export const getUnderneath = (e: Engine, pos: Vec2d) => {
	const query = () =>
		EntityRegistry.instance.lookupAndQuery(
			[Movable, Destructible, Collectable],
			(e) => {
				return e.position.equals(pos);
			},
		);
	let entity = query()[0];
	if (!entity) {
		promote(e, pos);
		entity = query()[0];
	}
	return entity;
};

export const Items: { [key: string]: Item } = {
	empty: {
		name: "none",
		sprite: ["", ""],
		usable: false,
		perform: async (): Promise<void> => {
			return;
		},
	},
	o2: {
		name: "o2",
		sprite: [await assetPath("o2"), await assetPath("o2")],
		usable: true,
		perform: async (
			e: Engine,
			actor: Movable & Air & Syncable,
		): Promise<void> => {
			actor.air += 10;
			if (actor.air > 100) {
				actor.air = 100;
			}
			if (actor.update) {
				actor.update({ air: actor.air });
			}
			return;
		},
	},
	pickaxe: {
		name: "pickaxe",
		sprite: [await assetPath("pickaxe"), await assetPath("pickaxe")],
		usable: true,
		perform: async (e: Engine, actor: Movable): Promise<void> => {
			if (e.state.currentCluster?.kind === TileKinds.tree) {
				const tile = e.mapBuilder.tiles[actor.position.x][actor.position.y];
				const positionKey = Vec2d({ x: actor.position.x, y: actor.position.y });

				const entity = getUnderneath(e, positionKey);

				entity.damage(7.5);

				if (entity.health <= 0) {
					e.menuHolder.setMenu(() =>
						Msg({ engine: e, msg: "You have felled a tree" }),
					);
					const tileUpdates = [];

					for (const p of e.state.currentCluster.points) {
						e.mapBuilder.tiles[p.x][p.y].mask = null;
						e.mapBuilder.tiles[p.x][p.y].promotable = undefined;

						const viewportCoords = e.mapBuilder.worldToViewport(p.x, p.y);
						if (viewportCoords) {
							const up = {
								x: viewportCoords.x,
								y: viewportCoords.y,
								tile: e.mapBuilder.tiles[p.x][p.y],
							};
							tileUpdates.push(up);
						}
					}

					entity.collect(Items.wood, Math.trunc(Math.random() * 5 + 1));
					EntityRegistry.instance.deleteAndQuery(
						[Movable, Destructible, Collectable],
						(e) => {
							return e.position.equals(positionKey);
						},
					);

					for (const up of tileUpdates) {
						await e.mapBuilder.updateViewportTile(up.x, up.y, up.tile);
					}
					await e.mapBuilder.removeCluster(e.state.currentCluster!);
				}
			} else {
				e.menuHolder.setMenu(() => Msg({ engine: e, msg: "Swung and missed" }));
			}
		},
	},
	hand: {
		name: "hand",
		sprite: [await assetPath("hand"), await assetPath("hand-r")],
		usable: true,
		perform: async (e: Engine, actor: Movable): Promise<void> => {
			if (e.state.currentCluster?.kind === TileKinds.tree) {
				const tile = e.mapBuilder.tiles[actor.position.x][actor.position.y];
				const positionKey = Vec2d({ x: actor.position.x, y: actor.position.y });

				const entity = getUnderneath(e, positionKey);
				entity.damage(3);

				if (entity.health <= 0) {
					const tileUpdates = [];

					for (const p of e.state.currentCluster.points) {
						e.mapBuilder.tiles[p.x][p.y].mask = null;
						e.mapBuilder.tiles[p.x][p.y].promotable = undefined; // Also clear promotable

						const viewportCoords = e.mapBuilder.worldToViewport(p.x, p.y);
						if (viewportCoords) {
							const up = {
								x: viewportCoords.x,
								y: viewportCoords.y,
								tile: e.mapBuilder.tiles[p.x][p.y], // Pass the modified tile
							};
							tileUpdates.push(up);
						}
					}

					entity.collect(Items.wood, Math.trunc(Math.random() * 5 + 1));
					EntityRegistry.instance.deleteAndQuery(
						[Movable, Destructible, Collectable],
						(e) => {
							return e.position.equals(positionKey);
						},
					);

					for (const up of tileUpdates) {
						await e.mapBuilder.updateViewportTile(up.x, up.y, up.tile);
					}
					await e.mapBuilder.removeCluster(e.state.currentCluster!);
				}
			} else if (e.state.currentCluster?.kind === TileKinds.berry) {
				const tile = e.mapBuilder.tiles[actor.position.x][actor.position.y];
				const positionKey = Vec2d({ x: actor.position.x, y: actor.position.y });

				const entity = getUnderneath(e, positionKey);
				const amt = Math.trunc(Math.random() * 10 + 1);
				entity.collect(Items.berry, amt);
				EntityRegistry.instance.deleteAndQuery(
					[Movable, Destructible, Collectable],
					(e) => {
						return e.position.equals(positionKey);
					},
				);
				tile.mask = null;
				tile.promotable = undefined;
				await e.mapBuilder.updateViewportTile(
					actor.position.x,
					actor.position.y,
					tile,
				);
				await e.mapBuilder.removeCluster(e.state.currentCluster!);
				e.menuHolder.setMenu(() =>
					Msg({ engine: e, msg: `You have picked ${amt} berries` }),
				);
			} else {
				e.menuHolder.setMenu(() =>
					Msg({ engine: e, msg: "Punching the air..." }),
				);
			}
		},
	},
	wood: {
		name: "wood",
		usable: false,
		sprite: [await assetPath("wood"), await assetPath("wood")],
		perform: async (e: Engine, actor: Entity): Promise<void> => {
			throw new Error("Function not implemented.");
		},
	},
	berry: {
		name: "berry",
		usable: true,
		sprite: [await assetPath("berry"), await assetPath("berry")],
		perform: async (
			e: Engine,
			actor: Movable & Destructible & Syncable & Inventory,
		): Promise<void> => {
			actor.heal(5);
			e.menuHolder.setMenu(() => Msg({ engine: e, msg: "You ate a berry" }));
			actor.removeHand(actor.dominant);

			if (actor.update) {
				actor.update({ health: actor.health, hands: actor.hands });
			}
		},
	},
};

export interface Inventory extends Entity {
	Items: { count: number; item: Item }[];
	hands: { right: Item; left: Item };
	dominant: "right" | "left";
	put: (item: { count: number; item: Item }) => void;
	handPut: (item: Item, hand: "left" | "right") => void;
	handSwap: () => void;
	remove: (item: { count: number; item: Item }) => void;
	removeHand: (hand: "left" | "right") => void;
}

export const Inventory: Component<
	Inventory,
	{
		slots: number;
		dominant: "right" | "left";
		Items?: { item: Item; count: number }[];
		hands?: { right: Item; left: Item };
	}
> = (base, params) => {
	const e = base as Entity & Inventory;
	e.Items =
		params.Items ||
		new Array(params.slots).fill({
			count: 0,
			item: Items.empty,
			usable: false,
		});
	e.hands = params.hands || {
		right: Items.hand,
		left: Items.hand,
	};
	e.dominant = params.dominant;
	e.handPut = (item: Item, hand: "left" | "right") => {
		e.hands[hand] = item;
	};
	e.handSwap = () => {
		const temp = e.hands.right;
		e.hands.right = e.hands.left;
		e.hands.left = temp;
	};
	e.put = (item: { count: number; item: Item }) => {
		let found = false;
		for (let i = 0; i < e.Items.length; i++) {
			const slot = e.Items[i];
			if (slot.item.name === item.item.name) {
				e.Items[i] = {
					count: slot.count + item.count,
					item: item.item,
				};
				found = true;
				break;
			}
		}
		// If not found, put in the first empty slot
		if (!found) {
			for (let i = 0; i < e.Items.length; i++) {
				const slot = e.Items[i];
				if (slot.item.name === "none") {
					e.Items[i] = {
						count: item.count,
						item: item.item,
					};
					break;
				}
			}
		}
	};
	e.remove = (item: { count: number; item: Item }) => {
		for (let i = 0; i < e.Items.length; i++) {
			const slot = e.Items[i];
			if (slot.item.name === item.item.name) {
				e.Items[i] = {
					count: Math.max(slot.count - item.count, 0),
					item: item.item,
				};
			}
		}
	};
	e.removeHand = (hand: "left" | "right") => {
		e.hands[hand] = Items.hand;
	};
	return e;
};

export interface MenuHolder extends Renderable, Syncable, Existable {
	displayed: boolean;
	Menu: () => JSX.Element;
	setMenu: (menu: () => JSX.Element) => void;
	menuOff: () => null;
}

export const MenuHolder: Component<MenuHolder, { menu: () => JSX.Element }> = (
	base,
	init,
) => {
	const e = base as Entity & MenuHolder & Syncable;
	e.displayed = false;
	e.Menu = init.menu;
	e.setMenu = (menu: () => JSX.Element) => {
		e.menuOff();
		e.Menu = menu;
		e.displayed = true;
		e.update({ Menu: menu, displayed: true });
	};
	e.menuOff = () => {
		e.displayed = false;
		e.update({ Menu: () => null, displayed: false });
		return null;
	};
	return e;
};

export const createMenuHolder = (engine: Engine) => {
	const e: Existable = { engine, _components: immutable.Set() };
	const built = new EntityBuilder(e)
		.add(MenuHolder, {
			menu: () => null,
		})
		.add(Syncable, "Menu");
	const builtEntity = built.build();
	return builtEntity;
};
