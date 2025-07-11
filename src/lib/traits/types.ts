import type { Engine } from "../index";

export interface Existable {
	engine: Engine;
}

export interface Entity extends Existable {
	char: string;
	fg?: string;
	bg?: string;
}
