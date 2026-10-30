<script lang="ts">
	import { BriefDocument, RunProgress, RunTrace } from '$lib/components/brief';
	import { sampleBrief } from '$lib/brief/fixtures/sample-brief';
	import { sampleEvents } from '$lib/brief/fixtures/sample-events';
</script>

<svelte:head><title>Brief preview (dev)</title></svelte:head>

<main class="bg-zinc-50 text-zinc-900 min-h-screen">
	<div class="mx-auto max-w-6xl space-y-4 px-4 pt-6 sm:px-6">
		<p class="text-zinc-500 text-xs">Dev preview with fixtures. Not available in production.</p>
		<RunProgress events={sampleEvents} status="complete" />
		<RunTrace events={sampleEvents} status="complete" />
	</div>
	<BriefDocument brief={sampleBrief} />
</main>
