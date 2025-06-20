import {
	useContext,
	createSignal,
	For,
	Show,
	onMount,
	createEffect,
} from "solid-js";
import { ConvexContext } from "~/convex";
import { createQuery } from "~/convex";
import { api } from "../../convex/_generated/api";
import { DB } from "~/lib/state";
import Game from "./game";
import MainMenu from "./main-menu";
import { useAuth, useSession } from "clerk-solidjs";
import { Engine } from "~/lib";

export default function Menu() {
	const convex = useContext(ConvexContext);
	const [convexAuth, setConvexAuth] = createSignal<boolean>(false);
	const session = useSession();
	const [currentState, setCurrentState] = createSignal<
		"Menu" | "select" | "loading" | "game"
	>("Menu");
	const [importFileInput, setImportFileInput] =
		createSignal<HTMLInputElement | null>(null);

	const fetchToken = async ({
		forceRefreshToken,
	}: {
		forceRefreshToken: boolean;
	}) => {
		try {
			const token = await session.session()?.getToken({ template: "convex" });
			return token || null;
		} catch (error) {
			console.error("Error fetching token:", error);
			return null;
		}
	};

	// Set up authentication once
	onMount(() => {
		if (convex) {
			convex.setAuth(fetchToken, (auth) => {
				console.log("auth", auth);
				setConvexAuth(auth);
			});
		}
	});

	// Create query only when authenticated
	const [tileSetsQuery, setTileSetsQuery] = createSignal<(() => any) | null>(
		null,
	);

	createEffect(() => {
		if (convexAuth() && convex) {
			const query = createQuery(api.functions.getTileSet.getTileSets, {});
			setTileSetsQuery(() => query);
		} else {
			setTileSetsQuery(null);
		}
	});

	const tileSets = () => {
		const query = tileSetsQuery();
		return query ? query() : null;
	};

	const handleNewGame = async () => {
		setCurrentState("loading");
		// TODO: Implement new game logic
		await engine.mapBuilder.genMap();
		setCurrentState("game");
	};
	const engine = new Engine(350, 350, convex!);

	const handleLoadGame = async (tileSetId: string) => {
		if (!tileSetId) return;
		setCurrentState("loading");
		console.log(tileSetId);
		engine.mapBuilder.mapId = tileSetId;
		await engine.mapBuilder.loadMap(tileSetId);
		setCurrentState("game");
	};

	const handleClear = async () => {
		if (!convex) return;
		setCurrentState("loading");
		try {
			const db = new DB(convex);
			await db.clear();
			setCurrentState("select");
		} catch (error) {
			console.error("Failed to clear database:", error);
			setCurrentState("select");
		}
	};

	const handleExportAll = async () => {
		if (!convex) return;
		setCurrentState("loading");
		try {
			const db = new DB(convex);
			// TODO: Implement export functionality
			setCurrentState("select");
		} catch (error) {
			console.error("Failed to export database:", error);
			setCurrentState("select");
		}
	};

	const handleImportAll = () => {
		if (importFileInput()) {
			importFileInput()!.click();
		}
	};

	const handleFileImport = async (event: Event) => {
		if (!convex) return;
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (files && files.length > 0) {
			const file = files[0];
			try {
				console.log("Attempting to import file:", file.name);
				setCurrentState("loading");
				const db = new DB(convex);
				await db.importAll(file);
				setCurrentState("select");
				console.log("Import process finished.");
			} catch (error) {
				console.error("Failed to import database:", error);
				setCurrentState("select");
				alert("Import failed: " + (error as Error).message);
			}
		}
	};

	return (
		<div class="bg-black flex flex-row justify-center items-center h-screen m-0 font-mono text-white">
			{currentState() === "Menu" && (
				<MainMenu
					handleNewGame={handleNewGame}
					setCurrentState={setCurrentState}
				/>
			)}

			{currentState() === "select" && (
				<div>
					<div id="selector" class="flex flex-col-reverse gap-2.5">
						<Show when={tileSets()}>
							<For
								each={tileSets() as Array<{ id: string; createdAt: string }>}
							>
								{(ts) => (
									<button
										type="button"
										onClick={() => handleLoadGame(ts.id)}
										class="bg-transparent border-2 border-white text-white text-base font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
									>
										{new Date(ts.createdAt).toLocaleString()}
									</button>
								)}
							</For>
						</Show>
					</div>
					<div class="flex flex-row gap-2.5 mt-4">
						<button
							type="button"
							onClick={handleClear}
							class="bg-transparent border-2 border-white text-white text-xs font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
						>
							Clear
						</button>
						<button
							type="button"
							onClick={handleExportAll}
							class="bg-transparent border-2 border-white text-white text-xs font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
						>
							Export All
						</button>
						<button
							type="button"
							onClick={handleImportAll}
							class="bg-transparent border-2 border-white text-white text-xs font-bold px-4 py-2 transition-all duration-200 ease-in-out hover:cursor-pointer hover:bg-white hover:text-black hover:-translate-y-0.5 active:translate-y-0"
						>
							Import All
						</button>
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

			{currentState() === "loading" && <p>WAIT</p>}

			{currentState() === "game" && (
				<div id="game" class="flex flex-col h-[90vh] w-[90vw] max-w-[1200px]">
					<Game engine={engine} />
				</div>
			)}
		</div>
	);
}
