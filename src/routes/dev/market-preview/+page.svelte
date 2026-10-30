<script lang="ts">
	import MarketDashboardView from '$lib/components/risk/MarketDashboardView.svelte';
	import { sampleDashboard } from '$lib/brief/fixtures/sample-dashboard';
</script>

<svelte:head><title>Market dashboard preview (dev)</title></svelte:head>

<main class="min-h-screen bg-zinc-50 text-zinc-900">
	<p class="mx-auto max-w-6xl px-4 pt-6 text-xs text-zinc-500 sm:px-6">
		Dev preview with fixtures. Not available in production.
	</p>
	<MarketDashboardView dashboard={sampleDashboard} />
</main>
