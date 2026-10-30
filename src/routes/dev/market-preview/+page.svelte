<script lang="ts">
	import MarketDashboardView from '$lib/components/risk/MarketDashboardView.svelte';
	import { sampleDashboard } from '$lib/brief/fixtures/sample-dashboard';
</script>

<svelte:head><title>Market dashboard preview (dev)</title></svelte:head>

<div class="min-h-screen bg-surface text-ink">
	<p class="mx-auto max-w-6xl px-4 pt-6 type-small text-ink-subtle sm:px-6">
		Dev preview with fixtures. Not available in production.
	</p>
	<MarketDashboardView dashboard={sampleDashboard} />
</div>
