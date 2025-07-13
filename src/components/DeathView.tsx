import type { Engine } from "~/lib";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function DeathView({ engine }: { engine: Engine }) {
	const handleRestart = async () => {
		await engine.convex.mutation(api.functions.saveTileSet.death, {
			tileSetId: engine.mapBuilder.mapId as Id<"tileSets">,
		});
		window.onbeforeunload = () => {};
		window.location.reload();
	};
	return (
		<div class="flex flex-col items-center justify-center h-screen bg-black text-white gap-4">
			<div class="text-center flex flex-col items-center justify-center gap-4">
				<h1 class="text-2xl font-bold">You are dead.</h1>
				<p class="text-lg">Respawning isn't real. Sorry.</p>
				<button
					type="button"
					class="bg-white text-black font-mono font-bold px-6 py-3 rounded-lg transition-all duration-200 ease-in-out hover:bg-gray-200 hover:scale-105 active:scale-95 shadow-lg"
					onclick={handleRestart}
				>
					Restart
				</button>
			</div>
		</div>
	);
}
