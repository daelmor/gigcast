<script lang="ts">
	import NewBriefForm from '$lib/components/new/NewBriefForm.svelte';

	let { data } = $props();
</script>

<svelte:head><title>New brief · gigcast</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="type-heading-1 sm:type-display">New booking brief</h1>
	<p class="mt-space-2 mb-space-6 type-body-lg text-ink-muted">
		Pick a market, an artist and a date window. The agent does the rest.
	</p>
	{#key `${data.market}|${data.artist}`}
		<NewBriefForm prefill={{ market: data.market, artist: data.artist }} />
	{/key}
</div>
