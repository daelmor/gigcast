<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '../ui/Button.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
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
	<SectionHeader
		id="sponsors"
		kicker="Section 4 · Sponsors"
		title="Sponsors"
		note={sponsors.note}
	/>
	{#if sponsors.picks.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No sponsor suggestions in this brief.
		</p>
	{:else}
		<ul class="grid gap-space-4 md:grid-cols-2">
			{#each sponsors.picks as pick (pick.entityId)}
				{@const text = `Subject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}`}
				<Card as="li" class="break-inside-avoid">
					<div class="flex items-start justify-between gap-space-2">
						<div class="min-w-0">
							<h3 class="type-heading-3 text-ink">{pick.name}</h3>
							{#if pick.category}<Chip class="mt-space-2">{pick.category}</Chip>{/if}
						</div>
						{#if pick.affinity !== undefined}
							<div class="text-right">
								<p class="type-heading-3 text-ink tabular-nums">{pct(pick.affinity)}</p>
								<p class="type-small text-ink-subtle">affinity</p>
							</div>
						{/if}
					</div>
					<p class="mt-space-3 type-body text-ink-muted">{pick.why}</p>
					<div class="mt-space-3 flex flex-wrap items-center gap-space-2">
						<EvidenceLabel label={pick.label} />
						<SourceMarks sources={pick.sources} />
					</div>
					<details class="mt-space-3 type-small">
						<summary class="cursor-pointer font-semibold text-signal">
							Outreach draft (a draft only; never sent)
						</summary>
						<div class="mt-space-2">
							<pre
								class="max-h-72 overflow-auto rounded-sm bg-surface-sunken p-space-3 type-data whitespace-pre-wrap text-ink">{text}</pre>
							<Button
								size="sm"
								class="mt-space-2 print:hidden"
								onclick={() => copy(pick.entityId, text)}
							>
								{copied === pick.entityId ? 'Copied' : 'Copy'}
							</Button>
						</div>
					</details>
				</Card>
			{/each}
		</ul>
		<p class="mt-space-3 type-small print:hidden">
			<a
				href={resolve('/brief/[id]/drafts', { id: brief.id })}
				class="font-semibold text-signal hover:underline"
			>
				All drafts on one page
			</a>
		</p>
	{/if}
</section>
