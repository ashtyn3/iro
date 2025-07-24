import type { Engine } from "./index";
import type { Entity, Movable } from "./traits";

export interface Act {
	perform: (e: Engine, actor: any) => Promise<void>;
}
