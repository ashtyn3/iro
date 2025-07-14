import { createEffect } from "solid-js";
import type { Engine } from "../lib";
import Button from "./Button";

export default function Pause({ engine }: { engine: Engine }) {
	return (
		<div class="flex flex-col gap-4 text-white text-center items-center justify-center h-full w-full absolute top-0 left-0 bg-black/50">
			<Button onClick={() => engine.clockSystem.toggle()}>Resume</Button>
			<Button onClick={() => window.location.reload()}>Quit</Button>
		</div>
	);
}
