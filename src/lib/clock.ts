import type { Engine } from ".";
import type { TimedEvent } from "./traits";

export class Clock {
	private events: Map<string, TimedEvent> = new Map();

	private current = 0;
	private done: Set<string> = new Set();
	private last = 0;
	private MAX_FRAMES = 1000000;

	constructor(private engine: Engine) {}
	addEvent(id: string, time: number, callback: () => void) {
		this.events.set(id, { id, time, callback });
	}
	getEvents() {
		return this.events;
	}
	removeEvent(id: string) {
		this.events.delete(id);
	}
	clearEvents() {
		this.events.clear();
	}
	act() {
		this.events.forEach(({ time, callback, id }) => {
			if (this.current % time === 0) {
				callback();
			}
		});
		this.current += 1;
		if (this.current > this.MAX_FRAMES) {
			this.current = 0;
		}
	}
}
