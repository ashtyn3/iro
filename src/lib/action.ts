import type { Entity, Movable } from "./entity";
import type { Engine } from "./index";

export interface Act {
    perform: (e: Engine, actor: Movable) => Promise<void>
}
