<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import DraftsView from '$lib/components/brief/DraftsView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Outreach drafts{data.brief ? ` · ${data.brief.draft.headline}` : ''} · gigcast</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.brief}
	<DraftsView brief={data.brief} />
{:else}
	<div class="mx-auto max-w-2xl rounded-lg bg-caution-soft p-space-5">
		<h1 class="type-heading-2 text-caution">
			{data.status === 'failed' ? 'This brief has no drafts' : 'The brief is still being built'}
		</h1>
		<p class="mt-space-2 type-body text-caution">
			{data.status === 'failed'
				? 'The run failed before any sponsor drafts were written.'
				: 'Outreach drafts appear once the run finishes, which takes about five minutes.'}
		</p>
		<Button variant="primary" href={resolve('/brief/[id]', { id: data.id })} class="mt-space-4">
			Back to the brief
		</Button>
	</div>
{/if}
