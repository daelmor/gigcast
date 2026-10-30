<script lang="ts">
	import MarketDashboardView from '$lib/components/risk/MarketDashboardView.svelte';
	import { sampleDashboard } from '$lib/brief/fixtures/sample-dashboard';
</script>

<svelte:head><title>Market dashboard preview (dev)</title></svelte:head>

<main class="bg-zinc-50 text-zinc-900 min-h-screen">
	<p class="text-zinc-500 mx-auto max-w-6xl px-4 pt-6 text-xs sm:px-6">
		Dev preview with fixtures. Not available in production.
	</p>
	<MarketDashboardView dashboard={sampleDashboard} />
</main>
