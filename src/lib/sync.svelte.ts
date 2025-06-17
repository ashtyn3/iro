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
}

export const Syncable: Component<Syncable, string> = (base, init) => {
    const e = base as Entity & Syncable;
    sinkMap.set(init, e)
    e.sink = () => sinkMap.get(init)!

    e.update = () => {
        sinkMap.set(init, { ...e });
    };
    return e
}
