<script lang="ts">
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { pct, words } from './format';
	import type { ArtistPick, Brief, Candidate } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const lineup = $derived(brief.draft.lineup);
	const candidates = $derived(brief.artifacts.lineupCandidates?.items ?? []);
	const byId = $derived(new Map(candidates.map((c) => [c.entityId.toLowerCase(), c])));
	const subjectId = $derived(brief.resolution.artist.entityId.toLowerCase());

	function candidateFor(pick: ArtistPick): Candidate | undefined {
		return byId.get(pick.entityId.toLowerCase());
	}

	function signalName(id: string): string {
		if (id.toLowerCase() === subjectId) return brief.resolution.artist.name;
		const known = byId.get(id.toLowerCase());
		if (known) return known.name;
		return id.length > 10 ? `${id.slice(0, 8)}…` : id;
	}

	function topWeights(c: Candidate) {
		const rows: { signal: string; entity: string; score: number }[] = [];
		for (const [signal, entries] of Object.entries(c.explainability ?? {})) {
			for (const e of entries)
				rows.push({ signal, entity: signalName(e.entityId), score: e.score });
		}
		return rows.sort((a, b) => b.score - a.score).slice(0, 6);
	}
</script>

<section aria-labelledby="lineup">
	<SectionHeader id="lineup" kicker="Section 3 · Lineup" title="Lineup" note={lineup.note} />
	{#if lineup.picks.length === 0}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			No lineup suggestions in this brief. {lineup.note.label === 'no_coverage'
				? 'Qloo returned no similar artists for this market.'
				: ''}
		</p>
	{:else}
		<ul class="grid gap-space-4 md:grid-cols-2">
			{#each lineup.picks as pick (pick.entityId)}
				{@const cand = candidateFor(pick)}
				<Card as="li" class="break-inside-avoid">
					<div class="flex flex-wrap items-start justify-between gap-space-2">
						<div class="min-w-0">
							<h3 class="type-heading-3 text-ink">{pick.name}</h3>
							<Chip class="mt-space-2">{words(pick.role)}</Chip>
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
					{#if cand && ((cand.tags?.length ?? 0) > 0 || Object.keys(cand.explainability ?? {}).length > 0)}
						{@const weights = topWeights(cand)}
						<details class="mt-space-3 type-small">
							<summary class="cursor-pointer font-semibold text-signal">Why Qloo links them</summary
							>
							<div class="mt-space-2 space-y-space-3">
								{#if cand.tags && cand.tags.length > 0}
									<div class="flex flex-wrap gap-space-2">
										{#each cand.tags as tag, i (i)}
											<Chip>{tag}</Chip>
										{/each}
									</div>
								{/if}
								{#if weights.length > 0}
									<ul class="space-y-1 text-ink-muted">
										{#each weights as w, i (i)}
											<li class="flex justify-between gap-space-3">
												<span
													><span class="text-ink-subtle">{words(w.signal)}:</span> {w.entity}</span
												>
												<span class="tabular-nums">{w.score.toFixed(2)}</span>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</details>
					{/if}
				</Card>
			{/each}
		</ul>
	{/if}
</section>
