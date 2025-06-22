import { For, onMount } from "solid-js";
import type { Engine } from "~/lib";
import type { PlayerType } from "~/lib/player";
// import hand from "~/lib/assets/hand.png";
// import handR from "~/lib/assets/hand-r.png";

export default function Game({ engine }: { engine: Engine }) {
	try {
		onMount(async () => {
			await engine.start();
			engine.renderDOM();
		});

		const player: () => PlayerType = () => engine.player.value() as PlayerType;

		return (
			<div class="w-full h-full bg-black">
				<div class="flex flex-row justify-between">
					<p>{player().air}% Air</p>
					<div class="flex flex-row gap-2">
						<For each={player().Items}>
							{(slot) =>
								slot?.item?.name !== "none" && (
									<div>
										{slot.item.name}x{slot.count}
									</div>
								)
							}
						</For>
					</div>
				</div>
				<div id="gamebox"></div>
				<div class="flex flex-row gap-2 justify-center m-5">
					<div class="border-2 border-white">
						<img
							src={player().hands.left.sprite[0]}
							alt={player().hands.left.name}
							class="w-15 h-15"
						/>
					</div>
					<div class="border-2 border-white">
						<img
							src={player().hands.right.sprite[1]}
							alt={player().hands.right.name}
							class="w-15 h-15"
						/>
					</div>
				</div>
			</div>
		);
	} catch (error) {
		console.error("Error creating Engine:", error);
		return (
			<div class="w-full h-full bg-red-500">
				<p>Error: {(error as Error).message}</p>
			</div>
		);
	}
}
