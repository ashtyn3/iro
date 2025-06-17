// entity.ts
import { Engine } from "./index";
import * as immutable from "immutable";
// Import Vec2d (the Record factory) from state.ts
import { Vec2d } from "./state";
import type { Item } from "./inventory";
import { applyMixins, type AddedOf, type Component, type ParamsOf, type UnionToIntersection } from "./comps";
import { VIEWPORT } from "./map";


export type EntityTypes = "norm" | "destructable" | "collectable";

// export class Entity {
//     position: Vec2d;
//     char: string;
//     fg: string | undefined;
//     bg: string | undefined;
//     engine: Engine;
//
//     constructor(e: Engine, pos: Vec2d, char: string, fg?: string, bg?: string) {
//         this.engine = e;
//         this.position = pos; // Assign the Immutable Record directly
//         this.char = char;
//         this.bg = bg;
//         this.fg = fg;
//     }
//
//     render() {
//         throw Error("Must implement");
//     }
//
//     // move(delta: { x: number, y: number }): void {
//     //     const newX = this.position.x + delta.x;
//     //     const newY = this.position.y + delta.y;
//     //
//     //     const oldPositionKey = this.position;
//     //     const newPositionKey = Vec2d({ x: newX, y: newY }); // Create new Immutable Vec2d Record for potential new key
//
//     //
//     //     // Boundary/collision checks
//     //     if (newY >= this.engine.height || newX >= this.engine.width || newX < 0 || newY < 0) return;
//     //     if (this.engine.mapBuilder.tiles[newX][newY].boundary) return;
//     //
//     //     // If position hasn't logically changed (e.g., delta was {0,0})
//     //     if (oldPositionKey.equals(newPositionKey)) {
//     //         return;
//     //     }
//     //
//     //     this.position = newPositionKey;
//     //
//     // }
// }

export interface Entity {
    engine: Engine,
    char: string,
    fg?: string,
    bg?: string
    render?: () => void
}

export function Entity(e: Engine, char: string, fg?: string, bg?: string): Entity {
    return {
        engine: e,
        char: char,
        fg,
        bg
    }
}

export interface Movable extends Entity {
    position: Vec2d
    move: (delta: Vec2d) => void
}

export const Movable: Component<Movable, Vec2d> = (base, init) => {
    const e = base as Entity & Movable

    e.position = init
    e.move = (delta: Vec2d): void => {
        const newX = e.position.x + delta.x;
        const newY = e.position.y + delta.y;

        const oldPositionKey = e.position;
        const newPositionKey = Vec2d({ x: newX, y: newY }); // Create new Immutable Vec2d Record for potential new key


        if (newY >= e.engine.height || newX >= e.engine.width || newX < 0 || newY < 0) return;
        if (e.engine.mapBuilder.tiles[newX][newY].boundary) return;

        if (oldPositionKey.equals(newPositionKey)) {
            return;
        }

        e.position = newPositionKey;

    }

    return e
}

export interface Destructible extends Entity {
    health: number
    damage(amount: number): void
}
export const Destructible: Component<Destructible, number> =
    (base, initialHealth) => {
        const e = base as Entity & Destructible
        // cast once to the widened type
        // add your data & methods
        e.health = initialHealth
        e.damage = (amt: number) => {
            e.health -= amt
        }
        return e
    }

export interface Collectable extends Entity {
    collect: (item: Item, amount: number) => boolean
}

export const Collectable: Component<Collectable, {}> =
    (base) => {
        // cast once to the widened type
        const e = base as Entity & Collectable
        e.collect = function (item: Item, amount: number): boolean {
            for (let i = 0; i < base.engine.player.Items.length; i++) {
                const slot = base.engine.player.Items[i];
                if (slot !== undefined) {
                    if (slot.item && slot.item.name === item.name) {
                        slot.count += amount;
                        base.engine.player.update()
                        return true;
                    }
                }
            }

            const findEmptySlot = (): number => {
                for (let i = 0; i < base.engine.player.Items.length; i++) {
                    if (base.engine.player.Items[i] === undefined || base.engine.player.Items[i].item.name === "None") {
                        return i;
                    }
                }
                return -1;
            }

            const emptyIdx = findEmptySlot();
            if (emptyIdx === -1) {
                return false;
            }

            base.engine.player.Items[emptyIdx] = {
                count: amount,
                item
            };
            base.engine.player.update()
            return true;

        }
        return e
    }

export class EntityBuilder<
    M extends Array<Component<any, any>> = []
> {
    private entries: Array<[Component<any, any>, any]>

    constructor(
        private base: Entity,
        entries?: Array<[Component<any, any>, any]>
    ) {
        this.entries = entries ?? []
    }

    add<Mi extends Component<any, any>>(
        fn: Mi,
        params: ParamsOf<Mi>
    ): EntityBuilder<[...M, Mi]> {
        const nextEntries = [
            ...this.entries,
            [fn, params],
        ] as Array<[Component<any, any>, any]>
        this.entries = nextEntries

        return this as unknown as EntityBuilder<[...M, Mi]>
    }

    build(): Entity & UnionToIntersection<AddedOf<M[number]>> {
        return applyMixins(
            this.base,
            ...this.entries
        ) as any
    }
}

export function promote(e: Engine, pos: Vec2d, params?: { [key: string]: any }): Entity {
    const tile = e.mapBuilder.tiles[pos.x][pos.y];
    let entity: Entity = Entity(e, tile.char, tile.fg, tile.bg);
    let builder = new EntityBuilder(entity)

    const make_entity = (type: string) => {
        type.split(",").forEach((t) => {
            switch (t) {
                case 'collectable':
                    builder.add(Collectable, {})
                    break;
                case 'destructable':
                    builder.add(Destructible, 15)
                    break;
            }
        })
    }
    if (tile.mask) {
        if (tile.mask.promotable) {
            make_entity(tile.mask.promotable.type)
        } else if (tile.promotable) {
            make_entity(tile.promotable.type)
        }
        e.state.entities = e.state.entities.set(pos, entity);
        return builder.build();
    }
}
