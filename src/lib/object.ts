import type { Engine } from "$lib";
import { Entity, type Vec2d } from "./entity";

export class Gobject extends Entity {
    parts: Array<Entity>

    constructor(e: Engine, name: string, ps: Array<Entity>, tl_pos: Vec2d) {
        super(e, tl_pos, name)
        this.parts = ps
    }
    move(delta: Vec2d): void {
        if (this.engine.mapBuilder.tiles[this.position.x + delta.x][this.position.y + delta.y].boundary) return
        this.parts.forEach((p) => {
            p.move(delta)
        })
    }
    render(): void {
        this.parts.forEach((p) => {
            this.engine.mapBuilder.tiles[p.position.x][p.position.y].mask = {
                fg: p.fg,
                bg: p.bg,
                char: p.char
            }
            // this.engine.display.drawOver(p.position.x, p.position.y, p.char, p.fg || null, p.bg || null)
        })
    }
}

export function box(
    e: Engine,
    size: Vec2d,
    tl_pos: Vec2d,
    border: { h: string; v: string },
    fill: string | null
) {
    const parts: Entity[] = [];

    const x0 = tl_pos.x - 1;       // left border
    const x1 = tl_pos.x + size.x;  // right border
    const y0 = tl_pos.y - 1;       // top border
    const y1 = tl_pos.y + size.y;  // bottom border

    // 1) Corners
    parts.push(new Entity(e, { x: x0, y: y0 }, "┌"));
    parts.push(new Entity(e, { x: x1, y: y0 }, "┐"));
    parts.push(new Entity(e, { x: x0, y: y1 }, "└"));
    parts.push(new Entity(e, { x: x1, y: y1 }, "┘"));

    // 2) Top & bottom edges (interior width)
    for (let dx = 0; dx < size.x; dx++) {
        parts.push(new Entity(e, { x: tl_pos.x + dx, y: y0 }, border.h));
        parts.push(new Entity(e, { x: tl_pos.x + dx, y: y1 }, border.h));
    }

    // 3) Left & right edges (interior height)
    for (let dy = 0; dy < size.y; dy++) {
        parts.push(new Entity(e, { x: x0, y: tl_pos.y + dy }, border.v));
        parts.push(new Entity(e, { x: x1, y: tl_pos.y + dy }, border.v));
    }
    if (fill !== null) {
        for (let dy = 0; dy < size.y; dy++) {
            for (let dx = 0; dx < size.x; dx++) {
                parts.push(
                    new Entity(e, { x: tl_pos.x + dx, y: tl_pos.y + dy }, fill),
                );
            }
        }
    }

    return new Gobject(e, "box", parts, tl_pos);
}

