import type * as immutable from "immutable";
import type { Engine } from "../index";

export interface Existable {
	engine: Engine;
	_components: immutable.Set<symbol>;
}

export interface Entity extends Existable {
	char: string;
	fg?: string;
	bg?: string;
}
