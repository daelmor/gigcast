<script lang="ts">
	import MarketDashboardView from '$lib/components/risk/MarketDashboardView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.dashboard.market.name} risk dashboard · gigcast</title>
</svelte:head>

<MarketDashboardView dashboard={data.dashboard} />
