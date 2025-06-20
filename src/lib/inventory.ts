import type { Engine } from "$lib"
import type { Act } from "./action"
import type { Component } from "./comps"
import { Entity, Movable, promote, type Collectable, type Destructible } from "./entity"
import { TileKinds, VIEWPORT } from "./map"
import { DB, Vec2d } from "./state"


export interface Item extends Act {
    name: string
    sprite: string[]
}

export const Items: { [key: string]: Item } = {
    empty: {
        name: "none",
        sprite: ["", ""],
        perform: async function (e: Engine, actor: Entity): Promise<void> {
            return
        }
    },
    hand: {
        name: "hand",
        sprite: [(await import("$lib/assets/hand.png")).default, (await import("$lib/assets/hand-r.png")).default],
        perform: async function (e: Engine, actor: Movable): Promise<void> {
            if (e.state.currentCluster?.kind == TileKinds.tree) {
                const tile = e.mapBuilder.tiles[actor.position.x][actor.position.y];
                let positionKey = Vec2d({ x: actor.position.x, y: actor.position.y });

                if (!e.state.entities.has(positionKey)) {
                    promote(e, positionKey);
                }

                const entity = e.state.entities.get(positionKey) as Entity & Destructible & Collectable;
                entity.damage(5)

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
                            }
                            tileUpdates.push(up)
                        }
                    }

                    entity.collect(
                        Items.wood,
                        Math.trunc((Math.random() * 5) + 1)
                    );
                    e.state.entities = e.state.entities.delete(positionKey);
                    for (const up of tileUpdates) {
                        await e.mapBuilder.updateViewportTile(up.x, up.y, up.tile);
                    }
                    await e.mapBuilder.removeCluster(e.state.currentCluster!);
                }
            }
        }
    },
    wood: {
        name: "wood",
        sprite: ["", ""],
        perform: async function (e: Engine, actor: Entity): Promise<void> {
            throw new Error("Function not implemented.")
        }
    }
}

export interface Inventory extends Entity {
    Items: { count: number, item: Item }[]
    hands: { right: Item, left: Item }
    dominant: "right" | "left"
}

export const Inventory: Component<Inventory, { slots: number, dominant: "right" | "left", Items?: { count: number, item: Item }[], hands?: { right: Item, left: Item } }> = (base, params) => {
    const e = base as Entity & Inventory
    e.Items = params.Items || new Array(params.slots);
    e.hands = params.hands || {
        right: Items.hand,
        left: Items.hand
    };
    e.dominant = params.dominant
    return e
}
