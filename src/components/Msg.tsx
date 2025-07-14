import { createEffect } from "solid-js";
import type { Engine } from "../lib";

export default function Msg({ engine, msg }: { engine: Engine; msg: string }) {
	createEffect(() => {
		setTimeout(() => {
			engine.menuHolder.setMenu(() => null);
		}, 1000);
	});
	return (
		<div class="text-white text-xs absolute bottom-0 right-0 flex gap-4 p-4 border-2 border-white m-4">
			{msg}
		</div>
	);
}
