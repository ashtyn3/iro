import type { Engine } from "$lib";
import type { Component } from "./comps";
import { Entity, EntityBuilder, Movable, Storeable } from "./entity";
import { Inventory } from "./inventory";
import { Vec2d } from "./state";
import { Syncable } from "./sync.svelte";

export const Player = (e: Engine, char: string, dominant: "left" | "right") => {
    const data: Entity = Entity(e, char)
    let builder = new EntityBuilder(data)
    let built = builder.add(Movable, Vec2d({ x: 4, y: 10 }))
        .add(Inventory, { slots: 5, dominant: dominant })
        .add(Syncable, "player")
        .add(Air, {})
        .add(Storeable, {})
        .build()
    built.render = () => {
        const vp = e.viewport()
        const px = built.position.x - vp.x;
        const py = built.position.y - vp.y;
        e.display.drawOver(px, py, built.char, "#FFF", null)
    }
    return built
}


export interface Air extends Entity {
    air: number
}

export const Air: Component<Air, {}> = (base, init) => {
    const e = base as Entity & Air;
    e.air = 0
    return e
}
