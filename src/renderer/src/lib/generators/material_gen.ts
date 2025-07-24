// src/materials/generator.ts

import { nanoid } from "nanoid";
import seedrandom from "seedrandom";
import fluidNameComps from "./fluid-name-components.json";
import oreNameComps from "./ore-name-components.json";

export type MaterialProperties = {
	density: number; // g/cm³
	Cp: number; // J/(g·K)
	k: number; // W/(m·K)
	meltingPoint: number; // K
	boilingPoint: number; // K
	hardness: number; // Mohs
	brittleness: number; // 0–1
	electricalConductivity: number; // S/m
	emissivity: number; // 0–1
	rarity: number; // 0–1
};

export type Material = {
	name: string;
	type: MaterialType;
	properties: MaterialProperties;
	abundance: number; // global mass fraction
	depositFrequency: number; // deposits per km²
	typicalDepositSize: number; // tons
	colors: {
		superFar: string;
		far: string;
		close: string;
	};
};

export type MaterialType =
	| "ore"
	| "crystal"
	| "alloy"
	| "glass"
	| "composite"
	| "fluid";

// 1) Rarity parameters (as before)
const RARITY_PARAMS = {
	depositRates: {
		common: 1.0,
		uncommon: 0.1,
		rare: 0.01,
		veryRare: 0.001,
	},
	pareto: {
		alpha: 2.5,
		minSize: 100,
	},
	clustering: {
		noiseScale: 0.1,
		clusterRadius: 5,
	},
};

// 2) Global abundance per type
const BASE_ABUNDANCE: Record<MaterialType, number> = {
	ore: 1e-4,
	crystal: 1e-5,
	alloy: 1e-3,
	glass: 1e-2,
	composite: 1e-4,
	fluid: 1e-3,
};

// 3) Per-type generation ranges
const genRanges: Record<
	MaterialType,
	Record<keyof MaterialProperties, [number, number]>
> = {
	ore: {
		density: [2, 8],
		Cp: [0.2, 1],
		k: [1, 10],
		meltingPoint: [800 + 273.15, 2000 + 273.15],
		boilingPoint: [2000 + 273.15, 3500 + 273.15],
		hardness: [3, 7],
		brittleness: [0.2, 0.6],
		electricalConductivity: [1e3, 1e6],
		emissivity: [0.3, 0.7],
		rarity: [0.08, 0.25], // Lower = more expansion
	},
	crystal: {
		density: [2, 6],
		Cp: [0.1, 0.8],
		k: [1, 5],
		meltingPoint: [600 + 273.15, 1800 + 273.15],
		boilingPoint: [1500 + 273.15, 3000 + 273.15],
		hardness: [5, 9],
		brittleness: [0.05, 0.4],
		electricalConductivity: [1e-2, 1e2],
		emissivity: [0.05, 0.3],
		rarity: [0, 1],
	},
	alloy: {
		density: [5, 12],
		Cp: [0.2, 0.5],
		k: [20, 300],
		meltingPoint: [900 + 273.15, 1600 + 273.15],
		boilingPoint: [2000 + 273.15, 3000 + 273.15],
		hardness: [2, 6],
		brittleness: [0.1, 0.5],
		electricalConductivity: [1e5, 6e7],
		emissivity: [0.2, 0.8],
		rarity: [0, 1],
	},
	glass: {
		density: [2, 3],
		Cp: [0.6, 0.8],
		k: [0.8, 1.5],
		meltingPoint: [1000 + 273.15, 1600 + 273.15],
		boilingPoint: [2500 + 273.15, 3000 + 273.15],
		hardness: [5, 7],
		brittleness: [0.1, 0.3],
		electricalConductivity: [1e-12, 1e-8],
		emissivity: [0.85, 0.95],
		rarity: [0, 1],
	},
	composite: {
		density: [1, 10],
		Cp: [0.2, 1],
		k: [0.5, 100],
		meltingPoint: [500 + 273.15, 2000 + 273.15],
		boilingPoint: [1000 + 273.15, 3500 + 273.15],
		hardness: [1, 8],
		brittleness: [0.1, 0.6],
		electricalConductivity: [1e-4, 1e6],
		emissivity: [0.2, 0.9],
		rarity: [0, 1],
	},
	fluid: {
		density: [0.5, 5],
		Cp: [1, 4],
		k: [0.1, 0.6],
		meltingPoint: [73 + 273.15, 673 + 273.15],
		boilingPoint: [123 + 273.15, 1273 + 273.15],
		hardness: [0, 0],
		brittleness: [0, 0],
		electricalConductivity: [1e-6, 1e2],
		emissivity: [0.8, 1.0],
		rarity: [0, 1],
	},
};

// Override ore depositFrequency and typicalDepositSize for more visible ore
const ORE_DEPOSIT_FREQ_RANGE: [number, number] = [0.25, 0.5]; // even more veins per km²
const ORE_DEPOSIT_SIZE_RANGE: [number, number] = [40, 80]; // much larger veins

// Patch makeMaterial for ore
export function makeMaterial(seed: string, type: MaterialType): Material {
	const name = generateName(seed, type);
	const abundance = generateAbundance(seed, type);
	const { rarity, depositFrequency, typicalDepositSize } = calculateRarity(
		seed,
		abundance,
	);
	const properties = generateProperties(seed, type);
	properties.rarity = rarity;

	let tunedDepositFrequency = depositFrequency;
	let tunedDepositSize = typicalDepositSize;
	if (type === "ore") {
		const rng = seedrandom(seed + "--ore-tune");
		tunedDepositFrequency =
			ORE_DEPOSIT_FREQ_RANGE[0] +
			rng() * (ORE_DEPOSIT_FREQ_RANGE[1] - ORE_DEPOSIT_FREQ_RANGE[0]);
		tunedDepositSize =
			ORE_DEPOSIT_SIZE_RANGE[0] +
			rng() * (ORE_DEPOSIT_SIZE_RANGE[1] - ORE_DEPOSIT_SIZE_RANGE[0]);
	}

	return {
		name,
		type,
		properties,
		abundance,
		depositFrequency: tunedDepositFrequency,
		typicalDepositSize: tunedDepositSize,
		colors: generateMaterialTileColors(seed, type),
	};
}

// simple uniform random
function rand(rng: seedrandom.PRNG, min: number, max: number) {
	return rng() * (max - min) + min;
}

// Pareto sample
function samplePareto(rng: seedrandom.PRNG, xm: number, α: number) {
	const u = rng();
	return xm / u ** (1 / α);
}

// log10, safe
function log10(x: number) {
	return Math.log(x) / Math.LN10;
}

// calculateRarity as before, but now typed
function calculateRarity(seed: string, abundance: number) {
	const rng = seedrandom(seed + "--rarity");

	// baseRarity: map log10(abundance) from [-8,0] → [0,1]
	const baseRarity = Math.min(1, Math.max(0, (log10(abundance) + 8) / 8));

	// deposit frequency (deposits/km²)
	const depositRate =
		RARITY_PARAMS.depositRates.common * 10 ** (-baseRarity * 3);

	// typical deposit size (tons)
	const size = samplePareto(
		rng,
		RARITY_PARAMS.pareto.minSize,
		RARITY_PARAMS.pareto.alpha,
	);

	// clustering factor
	const clustering = 1 + rng() * RARITY_PARAMS.clustering.noiseScale;

	// combine to final rarity
	const rarity = Math.min(
		1,
		Math.max(
			0,
			baseRarity * 0.4 +
				(1 - Math.min(1, depositRate)) * 0.3 +
				(1 - Math.min(1, size / 1e4)) * 0.2 +
				clustering * 0.1,
		),
	);

	return {
		rarity,
		depositFrequency: depositRate,
		typicalDepositSize: size,
	};
}

// generate abundance
function generateAbundance(seed: string, type: MaterialType) {
	const rng = seedrandom(`${seed}--abundance`);
	const base = BASE_ABUNDANCE[type];
	const variation = 0.75 + rng() * 0.5; // [0.75,1.25]
	return base * variation;
}

// universal name generator
function generateName(seed: string, type: MaterialType) {
	const rng = seedrandom(`${seed}--name`);
	const comps = type === "fluid" ? fluidNameComps : oreNameComps;
	const pick = (arr: string[]) => arr[Math.floor(rng() * arr.length)];
	return pick(comps.prefixes) + pick(comps.middles) + pick(comps.finals);
}

// generate properties
function generateProperties(seed: string, type: MaterialType) {
	const rng = seedrandom(`${seed}--props`);
	const props: Partial<MaterialProperties> = {};
	for (const key in genRanges[type]) {
		const [min, max] = genRanges[type][key as keyof MaterialProperties];
		props[key as keyof MaterialProperties] = rand(rng, min, max);
	}
	return props as MaterialProperties;
}

export function generateMaterialTileColors(
	seed: string,
	type: MaterialType,
): {
	superFar: string;
	far: string;
	close: string;
} {
	const rng = seedrandom(`${seed}--color`);

	// Assign base hue ranges per material type for visual distinction
	const typeHue: Record<MaterialType, [number, number]> = {
		ore: [10, 80], // earthy tones: dark browns, ochres, rusts, coppers, golds, warm grays
		crystal: [180, 260], // blue, violet
		alloy: [0, 60], // metallic, gold, bronze
		glass: [170, 200], // cyan, teal
		composite: [80, 160], // green, olive
		fluid: [200, 260], // blue, purple
	};

	const [hueMin, hueMax] = typeHue[type];
	const hue = Math.floor(rng() * (hueMax - hueMin) + hueMin);

	// Close: most saturated, lighter (closest) - vibrant, distinct mineral colors
	const close = hslToHex(hue, 45 + rng() * 35, 65 + rng() * 20);

	// Far: more saturated, mid-light - still distinct but weathered
	const far = hslToHex(hue, 35 + rng() * 25, 45 + rng() * 15);

	// Superfar: desaturated, dark (farthest, closest to black) - dark but still identifiable
	const superFar = hslToHex(hue, 15 + rng() * 10, 20 + rng() * 10);

	return { superFar, far, close };
}

function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) =>
		l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
	const r = Math.round(255 * f(0));
	const g = Math.round(255 * f(8));
	const b = Math.round(255 * f(4));
	return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

// main generator
export function generateMaterialInventory(seed: string, count: number) {
	const rng = seedrandom(`${seed}--inventory`);
	const inventory: Material[] = [];
	for (let i = 0; i < count; i++) {
		const type = ["ore", "crystal", "alloy", "glass", "composite"][
			Math.floor(rng() * 5)
		] as MaterialType;
		inventory.push(makeMaterial(`${seed}-${i}`, type));
	}
	return inventory;
}

console.log(generateMaterialInventory(nanoid(), 10));
