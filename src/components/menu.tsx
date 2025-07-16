import { useAuth, useSession } from "clerk-solidjs";
import {
	createEffect,
	createSignal,
	For,
	onMount,
	Show,
	useContext,
} from "solid-js";
import { ConvexContext, createQuery } from "~/convex";
import { Engine } from "~/lib";
import { Debug } from "~/lib/debug";
import { DB } from "~/lib/state";
import { api } from "../../convex/_generated/api";
import Button from "./Button";
import Game from "./game";
import MainMenu from "./main-menu";
import Settings from "./Settings";

export const GIT_SHA =
	import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

export default function Menu() {
	const convex = useContext(ConvexContext);
	const [convexAuth, setConvexAuth] = createSignal<boolean>(false);
	const session = useSession();
	const [currentState, setCurrentState] = createSignal<
		"Menu" | "select" | "loading" | "game" | "settings"
	>("Menu");
	const [importFileInput, setImportFileInput] =
		createSignal<HTMLInputElement | null>(null);
	const [engine, setEngine] = createSignal<Engine | null>(null);

	const fetchToken = async ({
		forceRefreshToken,
	}: {
		forceRefreshToken: boolean;
	}) => {
		try {
			const token = await session.session()?.getToken({ template: "convex" });
			return token || null;
		} catch (error) {
			Debug.getInstance().error(`Error fetching token: ${error}`);
			return null;
		}
	};

	onMount(() => {
		if (convex) {
			convex.setAuth(fetchToken, (auth) => {
				setConvexAuth(auth);
			});
		}
	});

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
	const [loadingSeconds, setLoadingSeconds] = createSignal(0);
	createEffect(() => {
		if (currentState() === "loading") {
			setInterval(() => {
				setLoadingSeconds(loadingSeconds() + 1);
			}, 1000);
		} else {
			setLoadingSeconds(0);
		}
	});

	const tileSets = () => {
		const query = tileSetsQuery();
		return query ? query() : null;
	};

	const handleNewGame = async () => {
		if (!convex) return;
		setCurrentState("loading");

		try {
			const newEngine = new Engine(350, 350, convex);
			setEngine(newEngine);
			const result = await newEngine.mapBuilder.genMap();
			if (!result.state) {
				alert(result.message);
				setCurrentState("select");
				return;
			}
			setCurrentState("game");
		} catch (error) {
			Debug.getInstance().error(`Failed to generate map: ${error}`);
			setCurrentState("select");
		}
	};

	const handleLoadGame = async (tileSetId: string) => {
		if (!convex || !tileSetId) return;
		setCurrentState("loading");
		try {
			const newEngine = new Engine(350, 350, convex);
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
		if (!convex) return;
		setCurrentState("loading");
		try {
			const db = new DB(convex);
			await db.clear();
			setCurrentState("select");
		} catch (error) {
			Debug.getInstance().error(`Failed to clear database: ${error}`);
			setCurrentState("select");
		}
	};

	const handleExportAll = async () => {
		if (!convex) return;
		setCurrentState("loading");
		try {
			const db = new DB(convex);

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
		if (!convex) return;
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (files && files.length > 0) {
			const file = files[0];
			try {
				Debug.getInstance().info(`Attempting to import file: ${file.name}`);
				setCurrentState("loading");
				const db = new DB(convex);
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
						<Show when={tileSets()}>
							<For
								each={tileSets() as Array<{ id: string; createdAt: string }>}
							>
								{(ts) => (
									<Button onClick={() => handleLoadGame(ts.id)}>
										{new Date(ts.createdAt).toLocaleString()}
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
