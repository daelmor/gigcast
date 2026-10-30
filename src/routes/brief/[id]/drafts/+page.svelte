<script lang="ts">
	import { resolve } from '$app/paths';
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
	<div class="bg-amber-50 ring-amber-200 mx-auto max-w-2xl rounded-xl p-6 ring-1">
		<h1 class="text-amber-900 text-xl font-semibold">
			{data.status === 'failed' ? 'This brief has no drafts' : 'The brief is still being built'}
		</h1>
		<p class="text-amber-900 mt-2 text-sm">
			{data.status === 'failed'
				? 'The run failed before any sponsor drafts were written.'
				: 'Outreach drafts appear once the run finishes, which takes about five minutes.'}
		</p>
		<a
			href={resolve('/brief/[id]', { id: data.id })}
			class="bg-indigo-600 text-white hover:bg-indigo-500 mt-4 inline-flex rounded-lg px-3 py-1.5 text-sm font-medium"
		>
			Back to the brief
		</a>
	</div>
{/if}
