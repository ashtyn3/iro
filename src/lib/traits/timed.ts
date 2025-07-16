import type { Component } from "../comps";
import type { Entity } from "./types";

export interface Timed extends Entity {
	ownedEvents: Set<string>;
}

export type TimedEvent = {
	id: string;
	time: number;
	callback: () => void;
};

export const Timed: Component<Timed, EventsBuilder> = (base, act) => {
	const e = base as Entity & Timed;
	e.ownedEvents = new Set();

	const events = act.build();
	events.forEach((event) => {
		e.ownedEvents.add(event.id);
		e.engine.clockSystem.addEvent(event.id, event.time, () => {
			const hasPathfinding = "seeking" in e || "seek" in e;
			if (hasPathfinding) {
				event.callback();
			} else {
				const hasViewport = "inViewport" in e || "inViewportWR" in e;
				if (hasViewport) {
					const inViewport =
						(e as any).inViewport?.() || (e as any).inViewportWR?.();
					if (inViewport) {
						event.callback();
					}
				} else {
					event.callback();
				}
			}
		});
	});

	return e;
};

class EventsBuilder {
	private events: TimedEvent[] = [];

	constructor(
		id: string,
		time: number,
		callback: () => void,
		events?: TimedEvent[],
	) {
		this.events.push(...(events || []), { id, time, callback });
	}

	and(id: string, time: number, callback: () => void) {
		const event = new EventsBuilder(id, time, callback, this.events);
		return event;
	}

	build() {
		return this.events;
	}
}

export const framesToSeconds = (frames: number, fps: number = 60) =>
	frames / fps;
export const secondsToFrames = (seconds: number, fps: number = 60) =>
	Math.round(seconds * fps);

export const Event = (
	id: string,
	time: number,
	callback: () => void,
	events?: TimedEvent[],
): EventsBuilder => {
	return new EventsBuilder(id, time, callback, events);
};
