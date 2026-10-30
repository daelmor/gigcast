<script lang="ts">
	import Label from '../ui/Label.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import SourceMarks from './SourceMarks.svelte';
	import { pct, words } from './format';
	import type { ArtistPick, Brief, Candidate } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const lineup = $derived(brief.draft.lineup);
	const candidates = $derived(brief.artifacts.lineupCandidates?.items ?? []);
	const byId = $derived(new Map(candidates.map((c) => [c.entityId.toLowerCase(), c])));
	const subjectId = $derived(brief.resolution.artist.entityId.toLowerCase());

	const roleStyles: Record<ArtistPick['role'], string> = {
		co_headliner: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
		opener: 'bg-sky-50 text-sky-700 ring-sky-600/20',
		support: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20'
	};

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
	<SectionHeader id="lineup" title="Lineup" note={lineup.note} />
	{#if lineup.picks.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			No lineup suggestions in this brief. {lineup.note.label === 'no_coverage'
				? 'Qloo returned no similar artists for this market.'
				: ''}
		</p>
	{:else}
		<ul class="grid gap-4 md:grid-cols-2">
			{#each lineup.picks as pick (pick.entityId)}
				{@const cand = candidateFor(pick)}
				<li class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div>
							<h3 class="text-zinc-900 font-semibold">{pick.name}</h3>
							<span
								class="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {roleStyles[
									pick.role
								]}">{words(pick.role)}</span
							>
						</div>
						{#if pick.affinity !== undefined}
							<div class="text-right">
								<p class="text-zinc-900 text-2xl font-semibold tabular-nums">
									{pct(pick.affinity)}
								</p>
								<p class="text-zinc-500 text-xs">affinity</p>
							</div>
						{/if}
					</div>
					<p class="text-zinc-700 mt-3 text-sm leading-relaxed">{pick.why}</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Label label={pick.label} />
						<SourceMarks sources={pick.sources} />
					</div>
					{#if cand && ((cand.tags?.length ?? 0) > 0 || Object.keys(cand.explainability ?? {}).length > 0)}
						{@const weights = topWeights(cand)}
						<details class="mt-3 text-sm">
							<summary class="text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
								Why Qloo links them
							</summary>
							<div class="mt-2 space-y-3">
								{#if cand.tags && cand.tags.length > 0}
									<div class="flex flex-wrap gap-1.5">
										{#each cand.tags as tag, i (i)}
											<span class="bg-zinc-100 text-zinc-700 rounded-full px-2 py-0.5 text-xs"
												>{tag}</span
											>
										{/each}
									</div>
								{/if}
								{#if weights.length > 0}
									<ul class="text-zinc-600 space-y-1 text-xs">
										{#each weights as w, i (i)}
											<li class="flex justify-between gap-3">
												<span><span class="text-zinc-500">{words(w.signal)}:</span> {w.entity}</span
												>
												<span class="tabular-nums">{w.score.toFixed(2)}</span>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
