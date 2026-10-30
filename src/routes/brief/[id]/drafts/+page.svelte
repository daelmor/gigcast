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
	<div class="mx-auto max-w-2xl rounded-xl bg-amber-50 p-6 ring-1 ring-amber-200">
		<h1 class="text-xl font-semibold text-amber-900">
			{data.status === 'failed' ? 'This brief has no drafts' : 'The brief is still being built'}
		</h1>
		<p class="mt-2 text-sm text-amber-900">
			{data.status === 'failed'
				? 'The run failed before any sponsor drafts were written.'
				: 'Outreach drafts appear once the run finishes, which takes about five minutes.'}
		</p>
		<a
			href={resolve('/brief/[id]', { id: data.id })}
			class="mt-4 inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
		>
			Back to the brief
		</a>
	</div>
{/if}
