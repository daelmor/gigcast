<script lang="ts">
	import { resolve } from '$app/paths';
	import Label from '../ui/Label.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { pct } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const sponsors = $derived(brief.draft.sponsors);
	let copied = $state<string>();

	async function copy(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => {
				if (copied === id) copied = undefined;
			}, 2000);
		} catch {
			// Clipboard unavailable: fail silently, the text is still selectable.
		}
	}
</script>

<section aria-labelledby="sponsors">
	<SectionHeader id="sponsors" title="Sponsors" note={sponsors.note} />
	{#if sponsors.picks.length === 0}
		<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
			No sponsor suggestions in this brief.
		</p>
	{:else}
		<ul class="grid gap-4 md:grid-cols-2">
			{#each sponsors.picks as pick (pick.entityId)}
				{@const text = `Subject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}`}
				<li class="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
					<div class="flex items-start justify-between gap-2">
						<div>
							<h3 class="font-semibold text-zinc-900">{pick.name}</h3>
							{#if pick.category}<p class="text-xs text-zinc-500">{pick.category}</p>{/if}
						</div>
						{#if pick.affinity !== undefined}
							<div class="text-right">
								<p class="text-2xl font-semibold text-zinc-900 tabular-nums">
									{pct(pick.affinity)}
								</p>
								<p class="text-xs text-zinc-500">affinity</p>
							</div>
						{/if}
					</div>
					<p class="mt-3 text-sm leading-relaxed text-zinc-700">{pick.why}</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Label label={pick.label} />
						<SourceMarks sources={pick.sources} />
					</div>
					<details class="mt-3 text-sm">
						<summary class="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800">
							Outreach draft (a draft only; never sent)
						</summary>
						<div class="mt-2">
							<pre
								class="max-h-72 overflow-auto rounded-lg bg-zinc-50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-800 ring-1 ring-zinc-200">{text}</pre>
							<button
								type="button"
								onclick={() => copy(pick.entityId, text)}
								class="mt-2 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 ring-1 ring-zinc-300 hover:bg-zinc-50"
							>
								{copied === pick.entityId ? 'Copied' : 'Copy'}
							</button>
						</div>
					</details>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-sm print:hidden">
			<a
				href={resolve('/brief/[id]/drafts', { id: brief.id })}
				class="font-medium text-indigo-600 hover:text-indigo-800"
			>
				All drafts on one page
			</a>
		</p>
	{/if}
</section>
