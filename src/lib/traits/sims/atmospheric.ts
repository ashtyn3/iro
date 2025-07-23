import * as Immutable from "immutable";
import type { Engine } from "~/lib";
import type { Component } from "../../comps";
import { createEntity, EntityBuilder } from "../../entity";
import { Syncable } from "../../sync";
import { type Entity, Event, Name, Named, Storeable, Timed } from "..";
import type { Existable } from "../types";

// const TICKS_PER_SECOND = import.meta.env.DEV ? 1 : 3;
const TICKS_PER_SECOND = 3;
const TICKS_PER_MINUTE = TICKS_PER_SECOND * (TICKS_PER_SECOND * 2);
const TICKS_PER_HOUR = TICKS_PER_MINUTE * TICKS_PER_SECOND;

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
type Season = (typeof SEASONS)[number];

export interface Time extends Existable {
	Second: bigint;
	Minute: bigint;
	Hour: bigint;
	Day: bigint;
	Month: bigint;
	Year: bigint;
	Season: Season;
	SeasonIndex: number;
	tick: () => void;
}

export const Time: Component<Time, {}> = (base, init) => {
	const e = base as Existable & Time;
	// Only initialize if values haven't been set yet (e.g., from sync)
	if (e.Hour === undefined) e.Hour = BigInt(0);
	if (e.Minute === undefined) e.Minute = BigInt(0);
	if (e.Second === undefined) e.Second = BigInt(0);
	if (e.Day === undefined) e.Day = BigInt(0);
	if (e.Month === undefined) e.Month = BigInt(0);
	if (e.Year === undefined) e.Year = BigInt(0);
	if (e.Season === undefined) e.Season = "Spring";
	if (e.SeasonIndex === undefined) e.SeasonIndex = 0;

	e.tick = () => {
		e.Second += 1n;
		if (e.Second >= BigInt(TICKS_PER_MINUTE)) {
			e.Second = 0n;
			e.Minute += 1n;
		}
		if (e.Minute >= BigInt(TICKS_PER_HOUR)) {
			e.Minute = 0n;
			e.Hour += 1n;
		}
		if (e.Hour >= BigInt(3)) {
			e.Hour = 0n;
			e.Day += 1n;
		}
		if (e.Day >= BigInt(30)) {
			e.Day = 0n;
			e.Month += 1n;
		}
		if (e.Month >= BigInt(12)) {
			e.Month = 0n;
			e.Year += 1n;
		}
		// Update season based on current month (3 months per season)
		const newSeasonIndex = Math.floor(Number(e.Month) / 3);
		if (newSeasonIndex !== e.SeasonIndex) {
			e.SeasonIndex = newSeasonIndex;
			e.Season = SEASONS[e.SeasonIndex];
		}
	};
	return e;
};

export function createTime(e: Engine) {
	const base = {
		engine: e,
		_components: Immutable.Set<symbol>(),
	};
	const built = new EntityBuilder(base)
		.add(Named, { name: "time" })
		.add(Time, {})
		.add(Storeable, "time")
		.add(Syncable, "time")
		.build();

	const builder = new EntityBuilder(built).add(
		Timed,
		Event("Time", TICKS_PER_SECOND, () => {
			built.tick();
			built.update({ ...built });
		}),
	);

	const final = builder.build();
	return final;
}

export interface Atmosphere extends Existable {}

export const Atmosphere: Component<Atmosphere, {}> = (base, init) => {
	const e = base as Existable & Atmosphere;
	return e;
};
