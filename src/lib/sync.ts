import { createStore, produce } from "solid-js/store";
import type { Component } from "./comps";
import type { Entity, Existable } from "./traits";
import type { Storeable } from "./traits/storeable";

export interface Syncable {
	syncable: boolean;
	update: (props: Partial<any>) => void;
	value: () => Existable;
	ready: () => boolean;
}

export const Syncable: Component<Syncable, string> = (base, init) => {
	const e = base as Entity & Syncable & Storeable;

	const initialState = { ...e };

	const [entityStore, setEntityStore] = createStore<typeof base>(initialState);

	e.value = () => {
		// Return the store as a reactive value
		return entityStore;
	};

	e.syncable = true;

	e.update = (props) => {
		setEntityStore(
			produce((current: any) => {
				for (const [key, value] of Object.entries(props)) {
					if (Array.isArray(value)) {
						current[key] = value.map((item: any) =>
							typeof item === "object" && item !== null ? { ...item } : item,
						);
					} else if (value && typeof value === "object") {
						current[key] = { ...current[key], ...value };
					} else {
						current[key] = value;
					}
				}
			}),
		);

		Object.assign(e, props);

		if (e.store) e.store();
	};

	return e;
};
