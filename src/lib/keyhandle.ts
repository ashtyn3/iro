import type { Engine } from "$lib";
import type { Act } from "./action";
import type { Entity, Movable } from "./entity";
import type { Inventory } from "./inventory";
import { Vec2d } from "./state";

const moveUpAction: Act = {
    perform: async (e: Engine, actor: Movable): Promise<void> => {
        actor.move(Vec2d({ y: -1, x: 0 }));
    }
};

const moveDownAction: Act = {
    perform: async (e: Engine, actor: Movable): Promise<void> => {
        actor.move(Vec2d({ y: 1, x: 0 }));
    }
};

const moveRightAction: Act = {
    perform: async (e: Engine, actor: Movable): Promise<void> => {
        actor.move(Vec2d({ y: 0, x: 1 }));
    }
};

const moveLeftAction: Act = {
    perform: async (e: Engine, actor: Movable): Promise<void> => {
        actor.move(Vec2d({ y: 0, x: -1 }));
    }
};

// --- Key Handles Definition ---

export const KeyHandles: { [key: string]: Act } = {
    // Movement Keys
    "w": moveUpAction,
    "ArrowUp": moveUpAction,

    "s": moveDownAction,
    "ArrowDown": moveDownAction,

    "d": moveRightAction,
    "ArrowRight": moveRightAction,

    "a": moveLeftAction,
    "ArrowLeft": moveLeftAction,

    // Interaction Keys
    "f": {
        perform: async (e: Engine, actor: Movable): Promise<void> => {
            const a = actor as Movable & Inventory;
            await a.hands[a.dominant].perform(e, actor);
        }
    }
};
