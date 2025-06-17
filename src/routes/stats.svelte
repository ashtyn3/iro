<script lang="ts">
    const { sink } = $props();
    const sync = $derived(sink.sink());
    let items = $state(sync.Items);
    let air = $state(sync.air);
    $effect(() => {
        items = sync.Items;
        air = sync.air;
    });
</script>

<div id="stats">
    <p id="air">{air || 0}% AIR</p>
    {#each items as item}
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
