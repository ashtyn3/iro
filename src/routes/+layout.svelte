<script lang="ts">
    import type { Snippet } from "svelte";
    import { ClerkProvider } from "svelte-clerk/client";
    import {
        PUBLIC_CLERK_PUBLISHABLE_KEY,
        PUBLIC_CONVEX_URL,
    } from "$env/static/public";
    import { setupConvex } from "convex-svelte";

    setupConvex(PUBLIC_CONVEX_URL);
    const { children }: { children: Snippet } = $props();
</script>

<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY}>
    {@render children()}
</ClerkProvider>
