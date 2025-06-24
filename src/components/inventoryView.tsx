import type { Engine } from "~/lib";
import { createSignal, For } from "solid-js";
import { type Item, Items } from "~/lib/inventory";

function cell({
	item,
	count,
	engine,
	i,
	hand = false,
}: {
	item: Item;
	count: number;
	engine: Engine;
	i: () => number;
	hand: boolean;
}) {
	const [sprite, setSprite] = createSignal(item.sprite[0]);
	if (hand) {
		if (i() === 0) {
			setSprite(item.sprite[1]);
		} else {
			setSprite(item.sprite[0]);
		}
	}
	return (
		<div
			class="bg-transparent border-2 border-white text-white font-bold transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center px-4 py-2"
			onclick={() => {
				console.log(item);
				if (hand && item.name !== "hand") {
					engine.player.handPut(Items.hand, engine.player.dominant);
					engine.player.put({ count: 1, item: item });
					engine.player.update({
						hands: { ...engine.player.hands },
						Items: [...engine.player.Items],
					});
				}
				if (!hand) {
					if (count > 0) {
						const item = engine.player.Items[i()];
						if (item.item.usable) {
							engine.player.Items[i()] = {
								count: 0,
								item: Items.empty,
							};
							const altHand =
								engine.player.dominant === "right" ? "left" : "right";
							if (engine.player.hands[engine.player.dominant].name !== "hand") {
								engine.player.handPut(item.item, altHand);
							} else if (engine.player.hands[altHand].name === "hand") {
								engine.player.handPut(item.item, engine.player.dominant);
							}
							if (
								engine.player.hands[engine.player.dominant].name !== "hand" &&
								engine.player.hands[altHand].name !== "hand"
							) {
								return;
							}
							engine.player.update({
								Items: [...engine.player.Items],
								hands: { ...engine.player.hands },
							});
						}
					}
				}
			}}
		>
			{sprite() ? (
				<img src={sprite()} alt={item.name} class="w-8 h-8 mb-1" />
			) : (
				<div class="w-8 h-8 mb-1" />
			)}
			<span class="text-xs">
				{!hand ? (
					item.name !== "none" && count > 0 ? (
						`x${count}`
					) : (
						"\u00A0"
					)
				) : (
					<span class="text-xs">{item.name}</span>
				)}
			</span>
		</div>
	);
}
function InventoryViewer({ engine }: { engine: Engine }) {
	// Get the first 6 items from the player's inventory
	const items = () => engine.player.value().Items;
	const hands = () => engine.player.value().hands;

	return (
		<div class="absolute top-0 left-0 w-full h-full bg-black/50 pointer-events-none flex items-center justify-center flex-col gap-5">
			<div class="grid grid-cols-3 grid-rows-2 gap-2 pointer-events-auto">
				<For each={items()}>
					{(slot, i) =>
						cell({
							item: slot.item,
							count: slot.count,
							engine,
							i: () => i(),
							hand: false,
						})
					}
				</For>
			</div>
			<div class="flex flex-row-reverse gap-2 pointer-events-auto">
				<For each={Object.values(hands())}>
					{(hand, i) => {
						return cell({
							item: hand as Item,
							count: 1,
							engine,
							i: () => i(),
							hand: true,
						});
					}}
				</For>
			</div>
		</div>
	);
}

export default InventoryViewer;
