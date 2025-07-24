import seedrandom from "seedrandom";
import mapNameComponents from "./map_name_components.json";

export function generateMapName(seed: string) {
	const prefixes = mapNameComponents.prefixes;
	const middles = mapNameComponents.middles;
	const finals = mapNameComponents.finals;

	const rng = seedrandom(`${seed}--map-name`);

	const prefix = prefixes[Math.floor(rng() * prefixes.length)];
	const middle = middles[Math.floor(rng() * middles.length)];
	const final = finals[Math.floor(rng() * finals.length)];

	return `${prefix}${middle}${final}`;
}