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

class UpdateQueue {
	private static instance: UpdateQueue;
	private queue: Map<Entity, { props: Partial<any>; setStore: Function }> =
		new Map();
	private processing = false;
	private scheduled = false;

	static getInstance(): UpdateQueue {
		if (!UpdateQueue.instance) {
			UpdateQueue.instance = new UpdateQueue();
		}
		return UpdateQueue.instance;
	}

	enqueue(entity: Entity, props: Partial<any>, setStore: Function) {
		const existing = this.queue.get(entity);
		if (existing) {
			this.queue.set(entity, {
				props: { ...existing.props, ...props },
				setStore: setStore,
			});
		} else {
			this.queue.set(entity, { props, setStore });
		}

		if (!this.scheduled) {
			this.scheduled = true;
			queueMicrotask(() => this.process());
		}
	}

	private process() {
		if (this.processing || this.queue.size === 0) {
			this.scheduled = false;
			return;
		}

		this.processing = true;

		for (const [entity, { props, setStore }] of this.queue.entries()) {
			this.applyUpdate(entity, props, setStore);
		}

		this.queue.clear();
		this.processing = false;
		this.scheduled = false;
	}

	private applyUpdate(entity: Entity, props: Partial<any>, setStore: Function) {
		setStore(
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

		Object.assign(entity, props);

		if ((entity as any).store) {
			(entity as any).store();
		}
	}

	flush() {
		if (this.queue.size > 0) {
			this.process();
		}
	}

	get size() {
		return this.queue.size;
	}
}

export const Syncable: Component<Syncable, string> = (base, init) => {
	const e = base as Entity & Syncable & Storeable;

	const initialState = { ...e };

	const [entityStore, setEntityStore] = createStore<typeof base>(initialState);

	e.value = () => {
		return entityStore;
	};

	e.syncable = true;

	e.update = (props) => {
		UpdateQueue.getInstance().enqueue(e, props, setEntityStore);
	};

	return e;
};

export const updateQueue = UpdateQueue.getInstance();
