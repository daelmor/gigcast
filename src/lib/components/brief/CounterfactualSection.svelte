<script lang="ts">
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import { CONFIDENCE_TONE } from '../ui/tones';
	import { comparisonRows, matchLine, summaryLines, type MatchTone } from './counterfactual';
	import { formatDuration, pct, words } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const panel = $derived(brief.counterfactual);
	const draft = $derived(panel?.draft);
	const lines = $derived(panel?.summary ? summaryLines(panel.summary) : undefined);

	const toneStyles: Record<MatchTone, { dot: string; text: string }> = {
		overlap: { dot: 'bg-grounded', text: 'font-semibold text-ink' },
		in_qloo: { dot: 'bg-grounded', text: 'text-ink-muted' },
		absent: { dot: 'bg-ink-subtle', text: 'text-ink-subtle' }
	};

	const blocks = $derived([
		{
			key: 'lineup',
			title: 'Lineup',
			rows: comparisonRows(draft?.lineup ?? [], panel?.matches?.lineup),
			grounded: brief.draft.lineup.picks.map((p) => ({ ...p, tag: words(p.role) }))
		},
		{
			key: 'sponsors',
			title: 'Sponsors',
			rows: comparisonRows(draft?.sponsors ?? [], panel?.matches?.sponsors),
			grounded: brief.draft.sponsors.picks.map((p) => ({ ...p, tag: p.category }))
		}
	]);

	const run = $derived(panel?.run);
	const tokens = $derived(run ? run.usage.inputTokens + run.usage.outputTokens : undefined);
	const duration = $derived(run ? Date.parse(run.finishedAt) - Date.parse(run.startedAt) : NaN);
</script>

<section aria-labelledby="counterfactual">
	<header class="mb-space-5 border-b border-line pb-space-4">
		<p class="mb-space-1 type-label text-ink-subtle">Section 5 · Comparison</p>
		<h2 id="counterfactual" class="scroll-mt-24 type-heading-1 text-ink">
			Would this work without Qloo?
		</h2>
		<p class="mt-space-3 max-w-3xl type-body text-ink-muted">
			We asked the model the same lineup and sponsor question with every data tool removed. The left
			column is what it answered from memory; the right column is what the grounded run produced
			from Qloo's results. The server checked every LLM-only name against the entities Qloo actually
			returned in this run.
		</p>
	</header>

	{#if !panel}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			This brief was built before the counterfactual run existed.
		</p>
	{:else if panel.status === 'failed'}
		<p class="rounded-lg bg-critical-soft p-space-4 type-small text-critical">
			The counterfactual run failed{panel.error ? `: ${panel.error}` : '.'}
		</p>
	{:else if panel.status === 'skipped' || !draft}
		<p class="rounded-lg bg-surface-sunken p-space-4 type-small text-ink-muted">
			The counterfactual run was skipped for this brief.
		</p>
	{:else}
		{#if lines}
			<ul class="mb-space-6 grid gap-space-3 sm:grid-cols-2">
				{#each [lines.lineup, lines.sponsors] as line, i (i)}
					<li class="rounded-lg bg-signal-soft p-space-4 type-body text-ink">
						{line}
					</li>
				{/each}
			</ul>
		{/if}

		{#each blocks as block (block.key)}
			<div class="mb-space-6">
				<h3 class="mb-space-3 type-heading-3 text-ink">{block.title}</h3>
				<div class="grid gap-space-5 md:grid-cols-2">
					<div class="space-y-space-3">
						<h4 class="type-label text-ink-subtle">LLM only (no tools)</h4>
						{#if block.rows.length === 0}
							<p class="rounded-lg bg-surface-sunken p-space-3 type-small text-ink-muted">
								The model made no picks.
							</p>
						{/if}
						<ul class="space-y-space-3">
							{#each block.rows as row, i (i)}
								{@const m = matchLine(row.match)}
								{@const tag = row.pick.role ? words(row.pick.role) : row.pick.category}
								<Card as="li" class="break-inside-avoid">
									<div class="flex flex-wrap items-center gap-space-2">
										<span class="type-heading-3 text-ink">{row.pick.name}</span>
										{#if tag}<Chip>{tag}</Chip>{/if}
										<Badge tone={CONFIDENCE_TONE[row.pick.confidence]}
											>{row.pick.confidence} confidence</Badge
										>
									</div>
									<p class="mt-space-2 type-body text-ink-muted">{row.pick.why}</p>
									<div class="mt-space-3 flex flex-wrap items-center gap-space-2">
										<EvidenceLabel label="inferred" />
										<span class="flex items-center gap-1.5 type-small {toneStyles[m.tone].text}">
											<span
												class="size-1.5 shrink-0 rounded-full {toneStyles[m.tone].dot}"
												aria-hidden="true"
											></span>
											{m.text}
										</span>
									</div>
								</Card>
							{/each}
						</ul>
					</div>

					<div class="space-y-space-3">
						<h4 class="type-label text-ink-subtle">Grounded in Qloo</h4>
						{#if block.grounded.length === 0}
							<p class="rounded-lg bg-surface-sunken p-space-3 type-small text-ink-muted">
								No grounded picks in this brief.
							</p>
						{/if}
						<ul class="space-y-space-3">
							{#each block.grounded as pick, i (i)}
								<Card as="li" class="break-inside-avoid">
									<div class="flex items-start justify-between gap-space-2">
										<div class="min-w-0">
											<span class="type-heading-3 text-ink">{pick.name}</span>
											{#if pick.tag}<span class="ml-1 type-small text-ink-subtle">{pick.tag}</span
												>{/if}
										</div>
										{#if pick.affinity !== undefined}
											<span class="type-heading-3 text-ink tabular-nums">{pct(pick.affinity)}</span>
										{/if}
									</div>
									<p class="mt-space-2 line-clamp-2 type-body text-ink-muted">{pick.why}</p>
									<div class="mt-space-3"><EvidenceLabel label={pick.label} /></div>
								</Card>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		{/each}

		{#if draft.caveats.length > 0}
			<ul class="max-w-3xl list-disc space-y-0.5 pl-5 type-small text-ink-subtle italic">
				{#each draft.caveats as caveat, i (i)}
					<li>{caveat}</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if panel}
		<p class="mt-space-4 type-small text-ink-subtle">
			Counterfactual run: {panel.model}{#if tokens !== undefined}
				· {tokens.toLocaleString('en-US')} tokens{/if}{#if Number.isFinite(duration) && duration >= 0}
				· {formatDuration(duration)}{/if}
		</p>
	{/if}
</section>
