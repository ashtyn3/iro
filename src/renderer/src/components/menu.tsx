import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { Engine } from "~/lib";
import { Debug } from "~/lib/debug";
import { DB } from "~/lib/state";
import { Storage } from "~/lib/storage";
import type { GameMenuState, MapGenerationResult, MapInfo } from "~/lib/types";
import Button from "./Button";
import Game from "./game";
import MainMenu from "./main-menu";
import Settings from "./Settings";

export const GIT_SHA =
	import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export default function Menu() {
	const [currentState, setCurrentState] = createSignal<GameMenuState>("Menu");
	const [importFileInput, setImportFileInput] =
		createSignal<HTMLInputElement | null>(null);
	const [engine, setEngine] = createSignal<Engine | null>(null);
	const [tilesets, setTilesets] = createSignal<MapInfo[]>([]);

	const [loadingSeconds, setLoadingSeconds] = createSignal(0);

	onMount(async () => {
		try {
			const maps = await Storage.instance.getAllMaps();
			setTilesets(maps);
		} catch (error) {
			Debug.getInstance().error(`Failed to load tilesets: ${error}`);
		}
	});

	createEffect(() => {
		if (currentState() === "loading") {
			setInterval(() => {
				setLoadingSeconds(loadingSeconds() + 1);
			}, 1000);
		} else {
			setLoadingSeconds(0);
		}
	});

	const handleNewGame = async () => {
		setCurrentState("loading");

		try {
			const storage = Storage.instance;
			const newEngine = new Engine(350, 350, storage as any);
			setEngine(newEngine);
			const result = await newEngine.mapBuilder.genMap();
			if (!result.state) {
				alert(result.message);
				setCurrentState("select");
				return;
			}
			// Refresh tilesets after creating a new one
			const maps = await Storage.instance.getAllMaps();
			setTilesets(maps);
			setCurrentState("game");
		} catch (error) {
			Debug.getInstance().error(`Failed to generate map: ${error}`);
			setCurrentState("select");
		}
	};

	const handleLoadGame = async (tileSetId: string) => {
		if (!tileSetId) return;
		setCurrentState("loading");
		try {
			const storage = Storage.instance;
			const newEngine = new Engine(350, 350, storage as any);
			setEngine(newEngine);
			Debug.getInstance().info(`Loading tileSetId: ${tileSetId}`);
			newEngine.mapBuilder.mapId = tileSetId;
			await newEngine.mapBuilder.loadMap(tileSetId);
			setCurrentState("game");
		} catch (error) {
			Debug.getInstance().error(`Failed to load game: ${error}`);
			setCurrentState("select");
		}
	};

	const handleClear = async () => {
		setCurrentState("loading");
		try {
			await Storage.instance.clearUserData();
			// Refresh tilesets after clearing
			const maps = await Storage.instance.getAllMaps();
			setTilesets(maps);
			setCurrentState("select");
		} catch (error) {
			Debug.getInstance().error(`Failed to clear data: ${error}`);
			setCurrentState("select");
		}
	};

	const handleExportAll = async () => {
		setCurrentState("loading");
		try {
			const db = new DB(null as any);

			setCurrentState("select");
		} catch (error) {
			Debug.getInstance().error(`Failed to export database: ${error}`);
			setCurrentState("select");
		}
	};

	const handleImportAll = () => {
		if (importFileInput()) {
			importFileInput()!.click();
		}
	};

	const handleFileImport = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (files && files.length > 0) {
			const file = files[0];
			try {
				Debug.getInstance().info(`Attempting to import file: ${file.name}`);
				setCurrentState("loading");
				const db = new DB(null as any);
				await db.importAll(file);
				setCurrentState("select");
				Debug.getInstance().info("Import process finished.");
			} catch (error) {
				Debug.getInstance().error(`Failed to import database: ${error}`);
				setCurrentState("select");
				alert("Import failed: " + (error as Error).message);
			}
		}
	};

	return (
		<div class="bg-black flex flex-row justify-center items-center h-screen m-0 font-mono text-white">
			{currentState() === "Menu" && (
				<>
					<MainMenu
						handleNewGame={handleNewGame}
						setCurrentState={setCurrentState}
					/>
					<div class="text-white text-xs absolute bottom-0 right-0 flex gap-4 p-4">
						<a href="/docs" class="text-white hover:text-gray-300 no-underline">
							GUIDE
						</a>
						<span>VERSION: {GIT_SHA}</span>
					</div>
				</>
			)}

			{currentState() === "select" && (
				<div>
					<Button
						size="sm"
						class="mb-4"
						onClick={() => setCurrentState("Menu")}
					>
						&lt; BACK
					</Button>
					<div id="selector" class="flex flex-col-reverse gap-2.5">
						<Show
							when={tilesets().length > 0}
							fallback={<p class="text-gray-400">No saved maps found</p>}
						>
							<For each={tilesets()}>
								{(tileset) => (
									<Button
										size="sm"
										onClick={() => handleLoadGame(tileset.id)}
										class="flex justify-between items-center"
									>
										<span>{tileset.name}</span>
										<span class="text-xs text-gray-400">
											{new Date(tileset.createdAt).toLocaleDateString()}
										</span>
									</Button>
								)}
							</For>
						</Show>
					</div>
					<div class="flex flex-row gap-2.5 mt-4">
						<Button size="sm" onClick={handleClear}>
							Clear
						</Button>
						<Button size="sm" onClick={handleExportAll}>
							Export All
						</Button>
						<Button size="sm" onClick={handleImportAll}>
							Import All
						</Button>
						<input
							type="file"
							ref={setImportFileInput}
							accept=".gz,application/gzip"
							class="hidden"
							onChange={handleFileImport}
						/>
					</div>
				</div>
			)}

			{currentState() === "loading" && <p>WAIT ({loadingSeconds()}s)</p>}

			{currentState() === "settings" && (
				<div>
					<Button size="sm" onClick={() => setCurrentState("Menu")}>
						&lt; BACK
					</Button>
					<Settings />
				</div>
			)}

			{currentState() === "game" && (
				<div id="game" class="flex flex-col h-[90vh] w-[90vw] max-w-[1200px]">
					<Show when={engine()}>
						<Game engine={engine()!} />
					</Show>
				</div>
			)}
		</div>
	);
}
