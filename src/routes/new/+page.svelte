<script lang="ts">
	import NewBriefForm from '$lib/components/new/NewBriefForm.svelte';

	let { data } = $props();
</script>

<svelte:head><title>New brief · gigcast</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="text-3xl font-semibold tracking-tight">New booking brief</h1>
	<p class="text-zinc-600 mt-2 mb-8">
		Pick a market, an artist and a date window. The agent does the rest.
	</p>
	{#key `${data.market}|${data.artist}`}
		<NewBriefForm prefill={{ market: data.market, artist: data.artist }} />
	{/key}
</div>
