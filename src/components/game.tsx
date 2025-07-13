import {
	createComputed,
	createEffect,
	createMemo,
	createSignal,
	For,
	onMount,
} from "solid-js";
import { effect } from "solid-js/web";
import type { Engine } from "~/lib";
import { Debug } from "~/lib/debug";
import type { Item, MenuHolder } from "~/lib/inventory";
import type { PlayerType } from "~/lib/player";
import InventoryViewer from "./inventoryView";

export function Inventory({ engine }: { engine: Engine }) {
	const itemArray = (): { count: number; item: Item }[] =>
		engine.player.value().Items;
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

export function HealthBar({ engine }: { engine: Engine }) {
	const player: () => PlayerType = () => engine.player.value() as PlayerType;
	const health = createMemo(() => Math.floor((player().health / 20) * 100));
	return (
		<div class="flex flex-row gap-2">
			<p>
				{health() < 50 ? (
					<span class="text-red-500">{health()}%</span>
				) : (
					<span class="text-green-500">{health()}%</span>
				)}
			</p>
		</div>
	);
}
export default function Game({ engine }: { engine: Engine }) {
	try {
		onMount(async () => {
			await engine.start();
			await engine.renderDOM();
		});

		const player: () => PlayerType = () => engine.player.value() as PlayerType;
		const menu = () => engine.menuHolder.value() as MenuHolder;

		return (
			<div class="w-full h-full bg-black">
				{menu().Menu()}
				<div class="flex flex-row justify-between">
					<p>{player().air}% Air</p>
					<HealthBar engine={engine} />
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
		Debug.getInstance().error(`Error creating Engine: ${error}`);
		return (
			<div class="w-full h-full bg-red-500">
				<p>Error: {(error as Error).message}</p>
			</div>
		);
	}
}
