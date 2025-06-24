import type { Engine } from "./index";
import type { Act } from "./action";
import type { Component } from "./comps";
import {
	type Entity,
	type Movable,
	promote,
	type Collectable,
	type Destructible,
	type Existable,
	type Renderable,
	EntityBuilder,
} from "./entity";
import { TileKinds, VIEWPORT } from "./map";
import { DB, Vec2d } from "./state";
import type { JSX } from "solid-js";
import { Syncable } from "./sync";

export interface Item extends Act {
	name: string;
	sprite: string[];
	usable: boolean;
}

export const assetPath = async (name: string) => {
	return (await import(`~/lib/assets/${name}.png`)).default;
};
export const Items: { [key: string]: Item } = {
	empty: {
		name: "none",
		sprite: ["", ""],
		perform: async (): Promise<void> => {
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

				if (!e.state.entities.has(positionKey)) {
					promote(e, positionKey);
				}

				const entity = e.state.entities.get(positionKey) as Entity &
					Destructible &
					Collectable;

				entity.damage(7.5);

				if (entity.health <= 0) {
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
					e.state.entities = e.state.entities.delete(positionKey);
					for (const up of tileUpdates) {
						await e.mapBuilder.updateViewportTile(up.x, up.y, up.tile);
					}
					await e.mapBuilder.removeCluster(e.state.currentCluster!);
				}
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
				let positionKey = Vec2d({ x: actor.position.x, y: actor.position.y });

				if (!e.state.entities.has(positionKey)) {
					promote(e, positionKey);
				}

				const entity = e.state.entities.get(positionKey) as Entity &
					Destructible &
					Collectable;
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
					e.state.entities = e.state.entities.delete(positionKey);
					for (const up of tileUpdates) {
						await e.mapBuilder.updateViewportTile(up.x, up.y, up.tile);
					}
					await e.mapBuilder.removeCluster(e.state.currentCluster!);
				}
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
};

export interface Inventory extends Entity {
	Items: { count: number; item: Item }[];
	hands: { right: Item; left: Item };
	dominant: "right" | "left";
	put: (item: { count: number; item: Item }) => void;
	handPut: (item: Item, hand: "left" | "right") => void;
}

export const Inventory: Component<
	Inventory,
	{
		slots: number;
		dominant: "right" | "left";
		Items?: Item[];
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
	const e: Existable = { engine };
	const built = new EntityBuilder(e)
		.add(MenuHolder, {
			menu: () => null,
		})
		.add(Syncable, "Menu");
	const builtEntity = built.build();
	return builtEntity;
};
