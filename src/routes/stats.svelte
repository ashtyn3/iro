<script lang="ts">
    const { sink } = $props();
    $effect(() => {
        console.log(sink.sink());
    });
</script>

<div id="stats">
    <p id="air">{sink.sink().air || 0}% AIR</p>
    {#each sink.sink().Items as item}
        {#if item !== undefined}
            {item.item.name}x{item.count}
        {/if}
    {/each}
</div>

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
