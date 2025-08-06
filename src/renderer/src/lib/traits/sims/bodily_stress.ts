import type { Component } from "~/lib/comps";
import type { Existable } from "..";

// Simplified physiological constants
const CORE_TEMP_NORMAL = 37;

// Flattened OrganicBody interface - no nested components
export interface OrganicBody extends Existable {
	// Muscle properties
	Fmax_I: number;
	Fmax_IIa: number;
	Fmax_IIx: number;
	tau_a_I: number;
	tau_a_IIa: number;
	tau_a_IIx: number;

	// Energy properties
	pcr_max: number;
	pcr_recovery_rate: number;
	lactate_threshold: number;
	lactate_clearance_rate: number;
	vo2_max: number;
	vo2_recovery_rate: number;
	o2_supply: number;
	glucose_max: number;
	glucose_consumption_rate: number;

	// Temperature properties
	mass: number;
	heat_capacity: number;
	efficiency: number;
	heat_loss_rate: number;

	// Fatigue properties
	lactate_weight: number;
	temperature_weight: number;
	time_weight: number;
	fatigue_rate: number;

	// Dynamic state variables
	a_I: number;
	a_IIa: number;
	a_IIx: number;
	PCr: number;
	Lactate: number;
	VO2: number;
	Glucose: number;
	Temp: number;
	FatigueLevel: number;
	F_cmd: number;
	F: number;
	F_max_tot: number;
	tick: (dt: number) => void;
}

export const OrganicBody: Component<OrganicBody, {}> = (base) => {
	const e = base as Existable & OrganicBody;

	// Initialize muscle properties
	e.Fmax_I = 100;
	e.Fmax_IIa = 150;
	e.Fmax_IIx = 200;
	e.tau_a_I = 0.5;
	e.tau_a_IIa = 0.3;
	e.tau_a_IIx = 0.2;

	// Initialize energy properties
	e.pcr_max = 25;
	e.pcr_recovery_rate = 1.0; // Increased for more visible recovery
	e.lactate_threshold = 0.05; // Lowered from 0.1 to make lactate production even more sensitive
	e.lactate_clearance_rate = 0.5; // Increased for more visible clearance
	e.vo2_max = 3.0;
	e.vo2_recovery_rate = 0.2; // Increased for more visible recovery
	e.o2_supply = 100;
	e.glucose_max = 100;
	e.glucose_consumption_rate = 1.0;

	// Initialize temperature properties
	e.mass = 10.0; // Reduced from 70.0 to make temperature changes more responsive
	e.heat_capacity = 500.0; // Reduced from 3500.0 to make temperature changes more responsive
	e.efficiency = 0.25;
	e.heat_loss_rate = 0.1; // Very small scaling factor for gradual changes

	// Initialize fatigue properties
	e.lactate_weight = 1.0; // Back to original
	e.temperature_weight = 0.5; // Back to original
	e.time_weight = 0.2; // Slightly increased from 0.1
	e.fatigue_rate = 1.0; // Back to original

	// Initialize state variables
	e.a_I = 0.0;
	e.a_IIa = 0.0;
	e.a_IIx = 0.0;
	e.PCr = 100; // Start fully rested
	e.Lactate = 0; // Start with no lactate
	e.VO2 = 0; // Start with no VO2
	e.Glucose = 20; // Start with some glucose
	e.Temp = CORE_TEMP_NORMAL;
	e.FatigueLevel = 0; // Start fully rested
	e.F_cmd = 0.0;
	e.F = 0.0;
	e.F_max_tot = e.Fmax_I + e.Fmax_IIa + e.Fmax_IIx;

	e.tick = (dt: number) => {
		// Muscle recruitment
		let remaining_force = e.F_cmd;

		// Recruit Type I fibers first
		const target_I = Math.min(1.0, remaining_force / e.Fmax_I);
		const da_I = (target_I - e.a_I) / e.tau_a_I;
		let new_a_I = e.a_I + dt * da_I;
		new_a_I = Math.max(0.0, Math.min(1.0, new_a_I));
		e.a_I = new_a_I;

		const force_I = e.a_I * e.Fmax_I;
		remaining_force = Math.max(0, remaining_force - force_I);

		// Recruit Type IIa fibers next
		const target_IIa = Math.min(1.0, remaining_force / e.Fmax_IIa);
		const da_IIa = (target_IIa - e.a_IIa) / e.tau_a_IIa;
		let new_a_IIa = e.a_IIa + dt * da_IIa;
		new_a_IIa = Math.max(0.0, Math.min(1.0, new_a_IIa));
		e.a_IIa = new_a_IIa;

		const force_IIa = e.a_IIa * e.Fmax_IIa;
		remaining_force = Math.max(0, remaining_force - force_IIa);

		// Recruit Type IIx fibers last
		const target_IIx = Math.min(1.0, remaining_force / e.Fmax_IIx);
		const da_IIx = (target_IIx - e.a_IIx) / e.tau_a_IIx;
		let new_a_IIx = e.a_IIx + dt * da_IIx;
		new_a_IIx = Math.max(0.0, Math.min(1.0, new_a_IIx));
		e.a_IIx = new_a_IIx;

		// Calculate total force (reduced by fatigue)
		const fatigue_factor = Math.max(0.1, 1.0 - e.FatigueLevel / 100);
		const total_force =
			e.a_I * e.Fmax_I + e.a_IIa * e.Fmax_IIa + e.a_IIx * e.Fmax_IIx;
		e.F = total_force * fatigue_factor;

		// Energy systems
		const force_ratio = e.F / e.F_max_tot;

		// Phosphagen system
		if (force_ratio > 0.1) {
			const pcr_usage = force_ratio * dt * 0.5;
			e.PCr = Math.max(0, e.PCr - pcr_usage);
		} else {
			const pcr_recovery = dt * e.pcr_recovery_rate;
			e.PCr = Math.min(100, e.PCr + pcr_recovery);
		}

		// Glycolytic system
		if (force_ratio > e.lactate_threshold) {
			// Calculate energy demand
			const energy_demand = (force_ratio - e.lactate_threshold) * dt * 4.0;

			// Use glucose if available, otherwise produce lactate
			if (e.Glucose > 0) {
				const glucose_used = Math.min(e.Glucose, energy_demand * 0.5); // Glucose is more efficient
				e.Glucose = Math.max(0, e.Glucose - glucose_used);

				// Only produce lactate for the remaining energy demand
				const remaining_demand = energy_demand - glucose_used;
				if (remaining_demand > 0) {
					e.Lactate = Math.min(100, e.Lactate + remaining_demand);
				}
			} else {
				// No glucose available, produce full lactate
				e.Lactate = Math.min(100, e.Lactate + energy_demand);
			}
		} else {
			const lactate_clearance = dt * e.lactate_clearance_rate;
			e.Lactate = Math.max(0, e.Lactate - lactate_clearance);
		}

		// Oxidative system
		if (force_ratio > 0.05) {
			const target_vo2 = force_ratio * 100;
			const limited_target_vo2 = Math.min(target_vo2, e.o2_supply);
			const vo2_change =
				(limited_target_vo2 - e.VO2) * dt * e.vo2_recovery_rate;
			e.VO2 = Math.max(0, Math.min(100, e.VO2 + vo2_change));
		} else {
			const vo2_decrease = dt * e.vo2_recovery_rate;
			e.VO2 = Math.max(0, e.VO2 - vo2_decrease);
		}
		// If body temperature is too low, apply cold stress effects
		if (e.Temp < 36.5) {
			// Increase fatigue due to cold
			const cold_stress = (36.5 - e.Temp) * 0.2; // Arbitrary scaling factor
			e.FatigueLevel = Math.min(100, e.FatigueLevel + cold_stress * dt);

			// Reduce max force output due to cold (simulate shivering/weakness)
			const cold_penalty = Math.max(0, (36.5 - e.Temp) * 0.01); // up to 1% per degree below 36.5
			e.F = e.F * (1 - cold_penalty);

			// If hypothermic (<35°C), apply health penalty
			if (e.Temp < 35) {
				if (
					"currentHealth" in e &&
					typeof (e as any).currentHealth === "number"
				) {
					(e as any).currentHealth = Math.max(0, (e as any).currentHealth - 1);
				}
			}
		}

		// Temperature
		const heat_production = force_ratio * 1; // Very small scaling factor for gradual changes
		const heat_loss = (e.Temp - CORE_TEMP_NORMAL) * e.heat_loss_rate * 100;
		const net_heat = heat_production - heat_loss;
		const temp_change = net_heat * dt * 0.1; // Much larger scaling factor for visible temperature changes
		e.Temp += temp_change;
		e.Temp = Math.max(35, Math.min(42, e.Temp));

		// Fatigue
		let fatigue_increase = 0;
		fatigue_increase += (e.Lactate / 100) * e.lactate_weight;
		const temp_excess = Math.max(0, e.Temp - CORE_TEMP_NORMAL);
		fatigue_increase += (temp_excess / 5) * e.temperature_weight;
		if (force_ratio > 0.2) {
			fatigue_increase += e.time_weight;
		}
		e.FatigueLevel = Math.min(
			100,
			e.FatigueLevel + dt * fatigue_increase * e.fatigue_rate,
		);

		if (force_ratio < 0.1) {
			e.FatigueLevel = Math.max(0, e.FatigueLevel - dt * 0.5);
		}
	};

	return e;
};

Object.defineProperty(OrganicBody, "name", {
	value: "OrganicBody",
	writable: false,
	enumerable: false,
	configurable: true,
});
