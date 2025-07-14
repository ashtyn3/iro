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

// Global update queue for batching updates
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
		// Merge with existing queued updates for this entity
		const existing = this.queue.get(entity);
		if (existing) {
			this.queue.set(entity, {
				props: { ...existing.props, ...props },
				setStore: setStore,
			});
		} else {
			this.queue.set(entity, { props, setStore });
		}

		// Schedule processing if not already scheduled
		if (!this.scheduled) {
			this.scheduled = true;
			// Use microtask to batch updates within the same tick
			queueMicrotask(() => this.process());
		}
	}

	private process() {
		if (this.processing || this.queue.size === 0) {
			this.scheduled = false;
			return;
		}

		this.processing = true;

		// Process all queued updates
		for (const [entity, { props, setStore }] of this.queue.entries()) {
			this.applyUpdate(entity, props, setStore);
		}

		// Clear the queue
		this.queue.clear();
		this.processing = false;
		this.scheduled = false;
	}

	private applyUpdate(entity: Entity, props: Partial<any>, setStore: Function) {
		// Apply store updates
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

		// Apply updates directly to the entity
		Object.assign(entity, props);

		// Trigger store callback if available
		if ((entity as any).store) {
			(entity as any).store();
		}
	}

	// Force immediate processing (useful for critical updates)
	flush() {
		if (this.queue.size > 0) {
			this.process();
		}
	}

	// Get queue size for debugging
	get size() {
		return this.queue.size;
	}
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
		// Queue both store and entity updates for batching
		UpdateQueue.getInstance().enqueue(e, props, setEntityStore);
	};

	return e;
};

// Export the queue for external access
export const updateQueue = UpdateQueue.getInstance();
