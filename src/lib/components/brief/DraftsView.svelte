<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '../ui/Button.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import { pct } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const picks = $derived(brief.draft.sponsors.picks);
	let copied = $state<string>();

	const mailto = (subject: string, body: string) =>
		`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

	async function copy(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => {
				if (copied === id) copied = undefined;
			}, 2000);
		} catch {
			// Clipboard unavailable: the text stays selectable on the page.
		}
	}
</script>

<div class="mx-auto max-w-3xl">
	<a
		href={resolve('/brief/[id]', { id: brief.id })}
		class="type-small font-semibold text-signal hover:underline print:hidden"
	>
		← Back to the brief
	</a>
	<p class="mt-space-4 type-label text-ink-subtle">Booking Brief</p>
	<h1 class="mt-space-1 type-heading-1 text-ink">Sponsor outreach drafts</h1>
	<p class="mt-space-2 type-body-lg text-ink-muted">{brief.draft.headline}</p>

	<div class="mt-space-5 rounded-lg bg-caution-soft p-space-4 type-small text-caution">
		These are drafts written by the model from Qloo affinity signals. Review and edit them before
		use. gigcast never sends anything: the email link only opens your own email app.
	</div>

	{#if picks.length === 0}
		<p class="mt-space-5 rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No sponsor suggestions in this brief, so there are no drafts.
		</p>
	{:else}
		<ul class="mt-space-5 space-y-space-5">
			{#each picks as pick (pick.entityId)}
				{@const text = `Subject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}`}
				<Card as="li" class="print:break-inside-avoid">
					<div class="flex flex-wrap items-start justify-between gap-space-3">
						<div class="min-w-0">
							<h2 class="type-heading-3 text-ink">{pick.name}</h2>
							{#if pick.category}<Chip class="mt-space-2">{pick.category}</Chip>{/if}
						</div>
						<div class="flex items-center gap-space-3">
							<EvidenceLabel label={pick.label} />
							{#if pick.affinity !== undefined}
								<div class="text-right">
									<p class="type-heading-3 text-ink tabular-nums">{pct(pick.affinity)}</p>
									<p class="type-small text-ink-subtle">affinity</p>
								</div>
							{/if}
						</div>
					</div>
					<p class="mt-space-3 type-body text-ink-muted">{pick.why}</p>

					<p class="mt-space-4 type-label text-ink-subtle">Subject</p>
					<p class="mt-space-1 type-body font-semibold text-ink">{pick.outreachDraft.subject}</p>
					<p class="mt-space-3 type-label text-ink-subtle">Body</p>
					<div
						class="mt-space-1 rounded-sm bg-surface-sunken p-space-4 type-body whitespace-pre-wrap text-ink"
					>
						{pick.outreachDraft.body}
					</div>

					<div class="mt-space-4 flex flex-wrap gap-space-2 print:hidden">
						<Button size="sm" onclick={() => copy(pick.entityId, text)}>
							{copied === pick.entityId ? 'Copied' : 'Copy'}
						</Button>
						<Button
							variant="primary"
							size="sm"
							href={mailto(pick.outreachDraft.subject, pick.outreachDraft.body)}
						>
							Open in your email app
						</Button>
					</div>
				</Card>
			{/each}
		</ul>
	{/if}
</div>
