import type { Engine } from "./index";
import type { Act } from "./action";
import type { Entity, Movable } from "./entity";
import { Items, type Inventory } from "./inventory";
import { Vec2d } from "./state";
import InventoryViewer from "~/components/inventoryView";

const moveUpAction: Act = {
	perform: async (e: Engine, actor: Movable): Promise<void> => {
		actor.move(Vec2d({ y: -1, x: 0 }));
	},
};

const moveDownAction: Act = {
	perform: async (e: Engine, actor: Movable): Promise<void> => {
		actor.move(Vec2d({ y: 1, x: 0 }));
	},
};

const moveRightAction: Act = {
	perform: async (e: Engine, actor: Movable): Promise<void> => {
		actor.move(Vec2d({ y: 0, x: 1 }));
	},
};

const moveLeftAction: Act = {
	perform: async (e: Engine, actor: Movable): Promise<void> => {
		actor.move(Vec2d({ y: 0, x: -1 }));
	},
};

// --- Key Handles Definition ---

export const KeyHandles: { [key: string]: Act } = {
	// Movement Keys
	w: moveUpAction,
	ArrowUp: moveUpAction,

	s: moveDownAction,
	ArrowDown: moveDownAction,

	d: moveRightAction,
	ArrowRight: moveRightAction,

	a: moveLeftAction,
	ArrowLeft: moveLeftAction,

	// Interaction Keys
	f: {
		perform: async (e: Engine, actor: Movable): Promise<void> => {
			const a = actor as Movable & Inventory;
			Items[await a.hands[a.dominant].name].perform(e, actor);
		},
	},
	i: {
		perform: async (e: Engine): Promise<void> => {
			if (e.menuHolder.displayed) {
				e.menuHolder.menuOff();
			} else {
				e.menuHolder.setMenu(() => InventoryViewer({ engine: e }));
			}
		},
	},
};
