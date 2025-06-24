import { For, onMount } from "solid-js";
import type { Engine } from "~/lib";
import type { Item, MenuHolder } from "~/lib/inventory";
import type { PlayerType } from "~/lib/player";
import InventoryViewer from "./inventoryView";
import { effect } from "solid-js/web";

export function Inventory({ engine }: { engine: Engine }) {
	const itemArray = (): Item[] => engine.player.value().Items;
	return (
		<div class="flex flex-row gap-2">
			<For each={itemArray()}>
				{(slot) =>
					slot?.item?.name !== "none" && (
						<div class="flex flex-row gap-2 items-center">
							<img
								src={slot.item.sprite[0]}
								alt={slot.item.name}
								class="w-8 h-8"
							/>
							x{slot.count}
						</div>
					)
				}
			</For>
		</div>
	);
}

export default function Game({ engine }: { engine: Engine }) {
	try {
		onMount(async () => {
			await engine.start();
			engine.renderDOM();
		});

		const player: () => PlayerType = () => engine.player.value() as PlayerType;
		const menu = () => engine.menuHolder.value() as MenuHolder;

		effect(() => {
			console.log(menu());
		});
		return (
			<div class="w-full h-full bg-black">
				{menu().Menu()}
				<div class="flex flex-row justify-between">
					<p>{player().air}% Air</p>
					<Inventory engine={engine} />
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
