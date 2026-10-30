<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.dashboard.market.name} · gigcast</title></svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
	<h1 class="text-2xl font-semibold">{data.dashboard.market.name}</h1>
	<p class="mt-2 text-sm text-zinc-500">Market dashboard placeholder; the UI lands with M4.</p>
</div>
