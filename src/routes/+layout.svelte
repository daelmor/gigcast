<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import Header from '$lib/components/shell/Header.svelte';
	import Footer from '$lib/components/shell/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	{#if !page.data.og}
		<meta property="og:title" content="gigcast: Booking Briefs grounded in cultural data" />
		<meta
			property="og:description"
			content="An artist, a city and a date window become a brief a promoter can take to a sponsor: audience map, lineup, sponsors, venues, pricing and risks, every claim labeled grounded, inferred or no coverage."
		/>
	{/if}
</svelte:head>

<div class="flex min-h-screen flex-col">
	<div class="print:hidden"><Header /></div>
	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
		{@render children()}
	</main>
	<Footer />
</div>
