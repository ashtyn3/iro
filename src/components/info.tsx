import { type Tile, TileKinds } from "~/lib/map";
import type { Engine } from "../lib";
import { MenuHolder } from "../lib/menu";

export default function Info({ engine, tile }: { engine: Engine; tile: Tile }) {
	return (
		<div class="text-white absolute bottom-1 left-1 border-2 border-white p-2">
			{tile.oreName || TileKinds[tile.kind]}
		</div>
	);
}
