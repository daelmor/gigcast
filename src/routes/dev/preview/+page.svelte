<script lang="ts">
	import { BriefDocument, RunProgress, RunTrace } from '$lib/components/brief';
	import { sampleBrief } from '$lib/brief/fixtures/sample-brief';
	import { sampleEvents } from '$lib/brief/fixtures/sample-events';
</script>

<svelte:head><title>Brief preview (dev)</title></svelte:head>

<main class="min-h-screen bg-surface text-ink">
	<div class="mx-auto max-w-6xl space-y-space-4 px-4 pt-space-5 sm:px-6">
		<p class="type-small text-ink-subtle">
			Dev preview with fixtures. Not available in production.
		</p>
		<RunProgress events={sampleEvents} status="complete" />
		<RunTrace events={sampleEvents} status="complete" />
	</div>
	<BriefDocument brief={sampleBrief} />
</main>
