<script lang="ts">
    import type { PlayerType } from "$lib/player";

    const { sink: player } = $props<{ sink: PlayerType }>();
</script>

{#if $player}
    <div id="stats">
        <p id="air">{$player.air}% AIR</p>
        {#each $player.Items as item}
            {#if item !== undefined}
                {item.item.name}x{item.count}
            {/if}
        {/each}
    </div>
{/if}

<style>
    #stats {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid #333;
    }

    #air {
        margin: 0;
        font-weight: bold;
    }
</style>
