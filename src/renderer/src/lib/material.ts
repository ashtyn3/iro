import type { Material } from "./generators/material_gen";

export const BASE_COLORS = {
	grass: {
		close: "#5C8A34",
		far: "#0F1A0B",
		superFar: "#050805",
	},
	water: {
		close: "#3A6EA5",
		far: "#0A111B",
		superFar: "#05080D",
	},
	rock: {
		close: "#7D7D7D",
		far: "#111111",
		superFar: "#050505",
	},
	copper: {
		close: "#8C5A2B",
		far: "#120B05",
		superFar: "#070402",
	},
	wood: {
		close: "#A67C52",
		far: "#1A1008",
		superFar: "#080503",
	},
	leafs: {
		close: "#4F7C45",
		far: "#0A0F08",
		superFar: "#030503",
	},
	struct: {
		close: "#7D7D7D",
		far: "#111111",
		superFar: "#050505",
	},
	tree: {
		close: "#4F7C45",
		far: "#0A0F08",
		superFar: "#030503",
	},
	berry: {
		close: "#C53030",
		far: "#661818",
		superFar: "#1F0808",
	},
	cursor: {
		close: "#FFFF00",
		far: "#B3B300",
		superFar: "#666600",
	},
	ore: {
		close: "#8B7355",
		far: "#2D2419",
		superFar: "#0F0E0A",
	},
};

export class MaterialRegistry {
	private static _instance: MaterialRegistry | null = null;

	private _colors: Record<
		string,
		{
			close: string;
			far: string;
			superFar: string;
		}
	> = {};

	private constructor() {
		this._colors = { ...BASE_COLORS };
	}

	static get instance(): MaterialRegistry {
		if (!MaterialRegistry._instance) {
			MaterialRegistry._instance = new MaterialRegistry();
		}
		return MaterialRegistry._instance;
	}

	registerMaterials(materials: Material[]) {
		materials.forEach((material) => {
			this.registerMaterial(material);
		});
	}

	registerMaterial(material: Material) {
		this._colors[material.name] = {
			close: material.colors.close,
			far: material.colors.far,
			superFar: material.colors.superFar,
		};
	}

	colors() {
		return this._colors;
	}
}

export const COLORS = MaterialRegistry.instance;
