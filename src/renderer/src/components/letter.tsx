import type { Engine } from "@renderer/lib";
import { For } from "solid-js";
import type { MapInfo } from "~/lib/types";
import Button from "./Button";

export default function Letter({
	mapHeader,
	engine,
}: {
	mapHeader: Partial<MapInfo>;
	engine: Engine;
}) {
	return (
		<div class="p-4 w-full h-full absolute top-0 left-0 bg-black flex flex-col items-center justify-center">
			<div class="relative w-[70%] h-[70%] bg-black border-2 border-white flex flex-col">
				<Button
					class="absolute top-2 right-2"
					aria-label="Close letter"
					onClick={() => {
						engine.menuHolder.menuOff();
					}}
				>
					X
				</Button>
				<div class="flex flex-col gap-2 p-6 items-center justify-center h-full w-full">
					<For each={mapHeader.letter?.letter || []}>
						{(line) => (
							<p class="text-white w-full whitespace-pre-wrap text-left">
								{line}
							</p>
						)}
					</For>
				</div>
			</div>
		</div>
	);
}
