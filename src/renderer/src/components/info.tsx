import type { MouseMoveListener } from "@renderer/lib/mouse";
import {
	type Accessor,
	createEffect,
	createSignal,
	For,
	type JSX,
	onMount,
} from "solid-js";
import { createStore } from "solid-js/store";
import { type Tile, TileKinds } from "~/lib/map";
import type { PlayerType } from "~/lib/player";
import type { Time } from "~/lib/traits/sims/atmospheric";
import type { Vec2d } from "~/lib/types";
import type { Engine } from "../lib";
import Button from "./Button";

// Types
type TabName = "info" | "stats" | "timeline" | "close";

interface TabHeaderProps {
	children: JSX.Element;
	name: TabName;
	setTab: (tab: TabName) => void;
	isActive?: boolean;
}

interface TabContentProps {
	engine: Engine;
	tile: () => Tile | undefined;
}

// Tab Header Component
const TabHeader = ({
	children,
	name,
	setTab,
	isActive = false,
}: TabHeaderProps) => {
	return (
		<Button
			onClick={() => setTab(name)}
			class={`px-3 py-1 ${isActive ? "bg-white text-black" : "bg-black text-white"}`}
			variant="custom"
		>
			{children}
		</Button>
	);
};

// Tab Content Components
const InfoTab = ({ engine, tile }: TabContentProps) => {
	const [currentTile, setCurrentTile] = createSignal<Tile | undefined>();
	const showMask = () => {
		const t = currentTile();
		return !!(t?.mask && t.mask.kind !== TileKinds.cursor);
	};
	const showOre = () => {
		const t = currentTile();
		return !!t?.oreName;
	};
	createEffect(() => {
		setCurrentTile(tile());
	});

	return (
		<div class="p-4">
			<h3 class="text-lg font-bold mb-2">Tile Information</h3>
			<div class="space-y-2">
				<p>
					<strong>Tile:</strong>{" "}
					{TileKinds[currentTile()?.kind ?? TileKinds.grass]}
				</p>
				{showMask() && (
					<p>
						<strong>Above:</strong>{" "}
						{TileKinds[currentTile()?.mask?.kind ?? TileKinds.cursor] ?? "None"}
					</p>
				)}
				{showOre() && (
					<p>
						<strong>Ore:</strong> {currentTile()?.oreName}
					</p>
				)}
				{/* {currentTile().promotable && (
					<p>
						<strong>Promotable:</strong> {currentTile().promotable?.type}
					</p>
				)} */}
			</div>
		</div>
	);
};

const StatsTab = ({ engine, tile }: TabContentProps) => {
	const player: () => PlayerType = () => engine.player.value() as PlayerType;
	const PlayerFatigue = () => {
		if (player().FatigueLevel > 59) {
			return "text-red-500";
		} else if (player().FatigueLevel > 39) {
			return "text-yellow-500";
		} else {
			return "text-green-500";
		}
	};
	return (
		<div class="p-4">
			<h3 class="text-lg font-bold mb-2">Statistics</h3>
			<div class="space-y-2">
				<p>
					<strong>Player Air:</strong> {player().air}%
				</p>
				<p>
					<strong>Player Health:</strong> {player().health}
				</p>
				<p>
					<strong>Player PCr:</strong> {player().PCr?.toFixed(1) || 0}%
				</p>
				<p>
					<strong>Player Lactate:</strong> {player().Lactate?.toFixed(1) || 0}%
				</p>
				<p>
					<strong>Player VO2:</strong> {player().VO2?.toFixed(1) || 0}%
				</p>
				<p>
					<strong>Player Glucose:</strong> {player().Glucose?.toFixed(1) || 0}%
				</p>
				<p>
					<strong>Player Fatigue:</strong>{" "}
					<span class={PlayerFatigue()}>
						{player().FatigueLevel?.toFixed(1) || 0}%
					</span>
				</p>
				<p>
					<strong>Player Temp:</strong> {player().Temp?.toFixed(2) || 0}°C
				</p>
			</div>
		</div>
	);
};

const TimelineTab = ({ engine, tile }: TabContentProps) => {
	const time = () => engine.time.value() as Time;
	return (
		<div class="p-4">
			<h3 class="text-lg font-bold mb-2">Timeline</h3>
			<div class="space-y-2">
				<p>
					<strong>Current time:</strong>{" "}
					{`${time().Hour.toString().padStart(2, "0")}:${time().Minute.toString().padStart(2, "0")}:${time().Second.toString().padStart(2, "0")}`}
				</p>
			</div>
		</div>
	);
};

// Main Info Component
export default function Info({ engine }: { engine: Engine }) {
	const [activeTab, setActiveTab] = createSignal<TabName>(
		(localStorage.getItem("infoTab") as TabName) || "info",
	);
	const [currentTile, setCurrentTile] = createSignal<Tile | undefined>();

	createEffect(() => {
		const mp = engine.infoMenu.value() as MouseMoveListener;
		const position = mp.position as Vec2d;
		const map = engine.mapBuilder;
		const tiles = map?.tiles;
		if (!tiles || tiles.length === 0 || !mp) {
			return;
		}

		const clamp = (v: number, min: number, max: number) =>
			Math.max(min, Math.min(v, max));

		const x = clamp(position.x, 0, map.width - 1);
		const y = clamp(position.y, 0, map.height - 1);
		let t = tiles[x]?.[y];

		if (!t && engine.player?.position) {
			const px = clamp(engine.player.position.x, 0, map.width - 1);
			const py = clamp(engine.player.position.y, 0, map.height - 1);
			t = tiles[px]?.[py];
		}

		setCurrentTile(t);
	});

	// Handle tab changes
	createEffect(() => {
		if (activeTab() === "close") {
			engine.infoMenu.menuOff();
		} else {
			localStorage.setItem("infoTab", activeTab());
		}
	});

	// Tab configuration
	const [tabs, setTabs] = createStore([
		{
			name: "close" as TabName,
			label: "X",
			component: () => null,
			active: false,
		},
		{
			name: "info" as TabName,
			label: "Info",
			component: InfoTab,
			active: false,
		},
		{
			name: "stats" as TabName,
			label: "Stats",
			component: StatsTab,
			active: false,
		},
		{
			name: "timeline" as TabName,
			label: "Timeline",
			component: TimelineTab,
			active: false,
		},
	]);
	onMount(() => {
		setTabs(
			tabs.map((t) => ({
				...t,
				active: t.name === localStorage.getItem("infoTab"),
			})),
		);
	});

	return (
		<div class="text-white absolute bottom-1 left-1 border-2 border-white p-2 h-1/2 w-1/3 bg-black flex flex-col min-h-0">
			{/* Header with tabs */}
			<div class="flex flex-row justify-between mb-2 flex-shrink-0">
				<div class="flex gap-1 flex-wrap">
					<For each={tabs}>
						{(tab) => (
							<TabHeader
								name={tab.name}
								setTab={() => {
									setTabs([
										...tabs.map((t) => {
											if (t.name === tab.name) {
												return { ...t, active: true };
											}
											return { ...t, active: false };
										}),
									]);
									setActiveTab(tab.name);
								}}
								isActive={tab.active}
							>
								{tab.label}
							</TabHeader>
						)}
					</For>
				</div>
			</div>

			{/* Content area */}
			<div class="border-2 border-white w-full flex-1 min-h-0 overflow-hidden">
				{activeTab() === "info" && (
					<InfoTab engine={engine} tile={currentTile} />
				)}
				{activeTab() === "stats" && (
					<StatsTab engine={engine} tile={currentTile} />
				)}
				{activeTab() === "timeline" && (
					<TimelineTab engine={engine} tile={currentTile} />
				)}
			</div>
		</div>
	);
}
