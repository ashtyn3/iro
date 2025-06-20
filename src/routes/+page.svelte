<script lang="ts">
    import { Engine } from "$lib/index";
    import hand from "$lib/assets/hand.png";
    import hand_r from "$lib/assets/hand-r.png";
    import pick from "$lib/assets/pickaxe.png";
    import { DB, type TilesSchema } from "$lib/state";
    import { onDestroy, onMount } from "svelte";
    import Stats from "./stats.svelte";
    import Hands from "./hands.svelte";
    import { SignedIn, SignedOut, SignUp, useClerkContext } from "svelte-clerk";
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "../convex/_generated/api";

    const client = useConvexClient();
    const ctx = useClerkContext();

    const fetchToken = async ({ forceRefreshToken }) => {
        try {
            const token = await ctx.session?.getToken({ template: "convex" });
            return token || null;
        } catch (error) {
            console.error("Error fetching token:", error);
            return null;
        }
    };
    let engine: Engine;
    onMount(() => {
        engine = new Engine(350, 350, client);
    });
    type State = "Menu" | "select" | "loading" | "game";
    let current_state = $state<State>("Menu");
    // let games = $state<TilesSchema[]>([]);
    let games = useQuery(api.functions.getTileSet.getTileSets, {});
    let importFileInput: HTMLInputElement;
    let user = useQuery(api.users.current, {});
    $effect(() => {
        client?.setAuth(fetchToken, (isAuthenticated) => {
            if (isAuthenticated) {
                console.log("isAuthenticated:", isAuthenticated);
            }
        });
        if (current_state === "game") {
            engine?.start().then(() => {
                engine?.renderDOM();
            });
        }
    });
</script>

<SignedOut>
    <SignUp />
</SignedOut>

<SignedIn>
    {#if current_state === "Menu"}
        <div id="menu">
            <h1>IRO</h1>
            <i>By Ashtyn</i>
            <button
                onclick={async () => {
                    current_state = "loading";
                    await engine?.mapBuilder.genMap();
                    current_state = "game";
                }}>&gt; NEW &lt;</button
            >
            <button
                onclick={async () => {
                    current_state = "select";
                }}>&gt; LOAD &lt;</button
            >
        </div>
    {/if}

    {#if current_state === "select"}
        <div>
            <div id="selector">
                {#each games.data ?? [] as ts}
                    <button
                        onclick={async () => {
                            if (!ts.id) return;
                            current_state = "loading";
                            engine.mapBuilder.mapId = ts.id;
                            await engine?.mapBuilder.loadMap(ts.id);
                            current_state = "game";
                        }}>{new Date(ts.createdAt).toLocaleString()}</button
                    >
                {/each}
            </div>
            <div style="display: flex; flex-direction: row; gap: 10px;">
                <button
                    style="margin-top: 15px; font-size: 10px;"
                    onclick={async () => {
                        const db = new DB(client);
                        current_state = "loading";
                        await db.clear();
                        current_state = "select";
                    }}>Clear</button
                >
                <button
                    style="margin-top: 15px; font-size: 10px;"
                    onclick={async () => {
                        const db = new DB(client);
                        current_state = "loading";
                        await db.exportAll();
                        current_state = "select";
                    }}>Export All</button
                >
                <button
                    style="margin-top: 15px; font-size: 10px;"
                    onclick={() => {
                        if (importFileInput) {
                            importFileInput.click();
                        }
                    }}>Import All</button
                >
                <input
                    type="file"
                    bind:this={importFileInput}
                    accept=".gz,application/gzip"
                    style="display: none;"
                    onchange={async (event) => {
                        const files = (event.target as HTMLInputElement).files;
                        if (files && files.length > 0) {
                            const file = files[0];
                            try {
                                console.log(
                                    "Attempting to import file:",
                                    file.name,
                                );
                                const db = new DB(client);
                                current_state = "loading"; // Show loading state during import
                                await db.importAll(file);
                                current_state = "select"; // Go back to select screen after import
                                // Re-fetch games to show any newly imported ones
                                new DB(client)
                                    .getAllTiles()
                                    .then((tilesets) => {
                                        games = tilesets;
                                    });
                                console.log("Import process finished.");
                            } catch (error) {
                                console.error(
                                    "Failed to import database:",
                                    error,
                                );
                                current_state = "select"; // Go back even on error
                                alert("Import failed: " + error.message); // Provide user feedback
                            }
                        }
                    }}
                />
            </div>
        </div>
    {/if}

    {#if current_state === "loading"}
        <p>WAIT</p>
    {/if}

    {#if current_state === "game"}
        <div id="game">
            <Stats sink={engine.player} />
            <div id="gamebox"></div>
            <Hands sink={engine.player} />
        </div>
    {/if}
</SignedIn>

<style>
    :global(body) {
        background-color: black;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        font-family: monospace;
        color: white;
    }

    #menu {
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-align: center;
    }

    #game {
        display: flex;
        flex-direction: column;
        height: 90vh;
        width: 90vw;
        max-width: 1200px;
    }

    #gamebox {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    button {
        background-color: transparent;
        border: 2px solid white;
        color: white;
        font-size: 1rem;
        font-weight: bold;
        padding: 0.5rem 1rem;
        transition: all 0.2s ease;
    }

    #selector {
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
    }
    button:hover {
        cursor: pointer;
        background-color: white;
        color: black;
        transform: translateY(-2px);
    }

    button:active {
        transform: translateY(0);
    }
</style>
