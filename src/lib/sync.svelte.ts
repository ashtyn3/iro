import { SvelteMap } from "svelte/reactivity";
import type { Component } from "./comps";
import type { Entity, Storeable } from "./entity";
import type { State } from "./state";
import { useConvexClient } from "convex-svelte";

// export let syncable = $state<{ s: State }>({ s: null })
//
// export function setSyncable(s: State) {
//     syncable.s = s
// }

export const sinkMap = new SvelteMap<string, any>();

type Listener = (entity: Entity) => void;

export interface Syncable {
    update: (props: Partial<any>) => void;
    subscribe: (callback: Listener) => () => void;
}

export const Syncable: Component<Syncable, string> = (base, init) => {
    const e = base as Entity & Syncable & Storeable;
    let listeners: Listener[] = [];

    let latestState = { ...e };

    e.subscribe = (callback: Listener) => {
        listeners.push(callback);
        callback(latestState);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        };
    };

    e.update = (props: Partial<Entity>) => {
        Object.assign(latestState, props);
        Object.assign(e, props);

        e.store();

        for (const listener of listeners) {
            listener(latestState);
        }
    };

    return e;
}
