<script lang="ts">
    import type { PlayerType } from "$lib/player";

    const { sink: player } = $props<{ sink: PlayerType }>();
</script>

{#if $player}
    <div id="hands">
        <div>
            <img src={$player.hands.left.sprite[0]} width="60" />
        </div>
        <div>
            <img src={$player.hands.right.sprite[1]} width="60" />
        </div>
    </div>
{/if}

<style>
    #hands {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    #hands div {
        border: 1px solid white;
        height: 64px;
        width: 64px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    }

    #hands img {
        transition: transform 0.2s ease;
    }

    #hands img:hover {
        transform: scale(1.1);
    }
</style>
