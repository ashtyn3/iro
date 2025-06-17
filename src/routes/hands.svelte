<script lang="ts">
    // import { syncable } from "$lib/sync.svelte";
</script>

<!-- <div id="hands"> -->
<!--     <div> -->
<!--         <img src={syncable?.s?.inventory.hands.left.sprite[0]} width="60" /> -->
<!--     </div> -->
<!--     <div> -->
<!--         <img src={syncable?.s?.inventory.hands.right.sprite[1]} width="60" /> -->
<!--     </div> -->
<!-- </div> -->

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
