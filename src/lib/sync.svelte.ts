import { SvelteMap } from "svelte/reactivity";
import type { Component } from "./comps";
import type { Entity } from "./entity";
import type { State } from "./state";
import { useConvexClient } from "convex-svelte";

// export let syncable = $state<{ s: State }>({ s: null })
//
// export function setSyncable(s: State) {
//     syncable.s = s
// }

let sinkMap = new SvelteMap<string, Entity>()

export interface Syncable {
    sink: () => Entity
    update: () => void
    listeners: (() => void)[]
    add_listener: (listener: () => Promise<void>) => void
    serialize: () => any
    deserialize: (data: any) => void
}

export const Syncable: Component<Syncable, string> = (base, init) => {
    const e = base as Entity & Syncable;
    sinkMap.set(init, e)
    e.sink = () => sinkMap.get(init)!
    e.listeners = []
    e.add_listener = (listener: () => void) => {
        e.listeners.push(listener)
    }

    e.serialize = () => {
        const { engine, ...serializableEntity } = e;
        return serializableEntity;
    };

    e.deserialize = (data: any) => {
        Object.assign(e, data);
    };

    e.update = async () => {
        sinkMap.set(init, { ...e });
        await Promise.all(e.listeners.map(async l => await l()))
    };
    return e
}
