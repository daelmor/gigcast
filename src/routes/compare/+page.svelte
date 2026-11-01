<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Card, Chip, EvidenceLabel, CONFIDENCE_TONE } from '$lib/components/ui';
	import type { Tone } from '$lib/components/ui';
	import { comparisonSnapshot as snap } from '$lib/brief/fixtures/comparison-snapshot';
	import type { ComparisonPick } from '$lib/brief/fixtures/comparison-snapshot';
	import type { CounterfactualMatch, CounterfactualPick } from '$lib/brief/schema';
	import { calibrateText } from '$lib/brief/wording';

	const pct = (n: number) => Math.round(n * 100);

	function matchStatus(m: CounterfactualMatch | undefined): { tone: Tone; text: string } {
		if (m?.pickedByGroundedRun)
			return { tone: 'positive', text: 'also picked by the grounded run' };
		if (m?.entityId) {
			return {
				tone: 'neutral',
				text: 'in the results' + (m.affinity !== undefined ? `, affinity ${pct(m.affinity)}%` : '')
			};
		}
		return { tone: 'neutral', text: 'not in the results for this run' };
	}

	function overlapSentence(
		overlap: number,
		inResults: number,
		total: number,
		kind: 'lineup' | 'sponsor'
	) {
		const word =
			total > 0 && overlap / total >= 0.5
				? 'overlap heavily'
				: overlap > 0
					? 'overlap partly'
					: 'do not overlap';
		return `${overlap} of ${total} model-alone ${kind} names were also picked by the grounded run and ${inResults} of ${total} appear in the results; the ${kind} arms ${word}.`;
	}

	const lineupSentence = $derived(
		overlapSentence(
			snap.summary.lineupOverlap,
			snap.summary.lineupInQloo,
			snap.summary.lineupTotal,
			'lineup'
		)
	);
	const sponsorSentence = $derived(
		overlapSentence(
			snap.summary.sponsorsOverlap,
			snap.summary.sponsorsInQloo,
			snap.summary.sponsorsTotal,
			'sponsor'
		)
	);
</script>

<svelte:head>
	<title>What changes with the taste graph · gigcast</title>
	<meta
		name="description"
		content="A dated, side-by-side comparison of the model alone and the agent with cultural-affinity evidence, with the sources behind each supported claim."
	/>
</svelte:head>

{#snippet modelItem(
	pick: CounterfactualPick,
	match: CounterfactualMatch | undefined,
	chipText: string | undefined
)}
	{@const status = matchStatus(match)}
	<Card as="li" class="space-y-space-2">
		<div class="flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
			<h4 class="type-heading-3">{pick.name}</h4>
			{#if chipText}<Chip>{chipText}</Chip>{/if}
			<Badge tone={CONFIDENCE_TONE[pick.confidence]}>{pick.confidence} confidence</Badge>
		</div>
		<p class="type-small text-ink-muted">{pick.why}</p>
		<Badge tone={status.tone} class="h-auto min-h-6 py-0.5 whitespace-normal">{status.text}</Badge>
	</Card>
{/snippet}

{#snippet groundedItem(pick: ComparisonPick, chipText: string | undefined)}
	<Card as="li" class="space-y-space-2">
		<div class="flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
			<h4 class="type-heading-3">{pick.name}</h4>
			{#if chipText}<Chip>{chipText}</Chip>{/if}
		</div>
		<div class="flex flex-wrap items-center gap-x-space-3 gap-y-space-1">
			{#if pick.affinity !== undefined}
				<p>
					<span class="type-heading-3 tabular-nums">{pct(pick.affinity)}%</span>
					<span class="type-small text-ink-muted">affinity</span>
				</p>
			{/if}
			<EvidenceLabel label={pick.label} />
			{#each pick.sourceNumbers as n (n)}
				<a href="#source-{n}" class="type-data-sm text-signal no-underline hover:underline"
					>[S{n}]</a
				>
			{/each}
		</div>
		{#if pick.tags.length}
			<ul class="flex flex-wrap gap-space-1">
				{#each pick.tags as tag, i (i)}
					<li><Chip>{tag}</Chip></li>
				{/each}
			</ul>
		{/if}
		<details>
			<summary class="cursor-pointer type-small font-semibold text-ink-muted">Why this pick</summary
			>
			<!-- gigcast's own prose gets the same read-time claim rules as the brief page. -->
			<p class="mt-space-2 type-small text-ink-muted">{calibrateText(pick.why)}</p>
		</details>
	</Card>
{/snippet}

<div class="space-y-space-7">
	<header>
		<p class="type-label text-ink-subtle">Comparison</p>
		<h1 class="mt-space-2 type-heading-1 sm:type-display">
			What changes when the agent has the taste graph
		</h1>
		<p class="mt-space-3 max-w-2xl type-body-lg text-ink-muted">
			An LLM can suggest plausible names. gigcast retrieves cultural-affinity evidence for the
			selected artist and market and shows where each supported claim came from. Grounding does not
			prove ticket demand or commercial feasibility.
		</p>
	</header>

	<Card class="space-y-space-2 type-small">
		<p>
			Pre-computed comparison, run on {snap.runDate}, same artist / city / dates / model for both
			arms.
		</p>
		<p class="text-ink-muted">
			{snap.resolution.artist} · {snap.resolution.locality}, {snap.input.country} · {snap.input
				.dateFrom} to {snap.input.dateTo} · {snap.model}
		</p>
		<p>
			<a
				href={resolve('/brief/[id]', { id: snap.briefId })}
				class="font-semibold text-signal hover:underline">Open the brief</a
			>
		</p>
		<p class="text-ink-muted">
			The model-alone arm ran with no tools at all; the gigcast arm ran the twelve typed tools ({snap
				.mainRun.toolCalls} tool calls, {snap.mainRun.qlooCalls} data requests). Nothing on this page
			is recomputed per visit.
		</p>
	</Card>

	<section aria-labelledby="lineup-title">
		<h2 id="lineup-title" class="type-heading-1">Lineup</h2>
		<div class="mt-space-4 grid gap-space-5 md:grid-cols-2">
			<div class="min-w-0 space-y-space-3">
				<h3 class="type-heading-2">Model alone (no tools)</h3>
				<ul class="space-y-space-3">
					{#each snap.modelAlone.lineup as pick, i (i)}
						{@render modelItem(pick, snap.matches.lineup[i], pick.role?.replaceAll('_', ' '))}
					{/each}
				</ul>
				<p class="type-small text-ink-subtle">
					A name absent from the result list is not wrong: the taste graph returned the top {snap
						.candidatePool.lineup} artists for this query, and the model may know names the list does
					not rank.
				</p>
			</div>
			<div class="min-w-0 space-y-space-3">
				<h3 class="type-heading-2">gigcast + taste graph</h3>
				<ul class="space-y-space-3">
					{#each snap.grounded.lineup as pick, i (i)}
						{@render groundedItem(pick, pick.role?.replaceAll('_', ' '))}
					{/each}
				</ul>
				<p class="type-small text-ink-subtle">
					Tags are what the taste graph attaches to each entity, shown for context.
				</p>
			</div>
		</div>
		<p class="mt-space-4 type-body">{lineupSentence}</p>
	</section>

	<section aria-labelledby="sponsors-title">
		<h2 id="sponsors-title" class="type-heading-1">Sponsors</h2>
		<div class="mt-space-4 grid gap-space-5 md:grid-cols-2">
			<div class="min-w-0 space-y-space-3">
				<h3 class="type-heading-2">Model alone (no tools)</h3>
				<ul class="space-y-space-3">
					{#each snap.modelAlone.sponsors as pick, i (i)}
						{@render modelItem(pick, snap.matches.sponsors[i], pick.category)}
					{/each}
				</ul>
				<p class="type-small text-ink-subtle">
					A name absent from the result list is not wrong: the taste graph returned the top {snap
						.candidatePool.sponsors} brands for this query, and the model may know names the list does
					not rank.
				</p>
			</div>
			<div class="min-w-0 space-y-space-3">
				<h3 class="type-heading-2">gigcast + taste graph</h3>
				<ul class="space-y-space-3">
					{#each snap.grounded.sponsors as pick, i (i)}
						{@render groundedItem(pick, pick.category)}
					{/each}
				</ul>
				<p class="type-small text-ink-subtle">
					Tags are what the taste graph attaches to each entity, shown for context.
				</p>
			</div>
		</div>
		<p class="mt-space-4 type-body">{sponsorSentence}</p>
	</section>

	<section aria-labelledby="caveats-title">
		<h2 id="caveats-title" class="type-heading-1">What the model said it could not know</h2>
		<ul class="mt-space-4 list-disc space-y-space-2 pl-space-5 type-small">
			{#each snap.modelAlone.caveats as c, i (i)}
				<li>{c}</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="sources-title">
		<h2 id="sources-title" class="type-heading-1">Sources</h2>
		<p class="mt-space-2 type-small text-ink-subtle">
			Numbers are the brief's own source numbers, so [S10] here is [S10] on the brief page; only the
			sources the lineup and sponsor picks cite are listed.
		</p>
		<ol class="mt-space-4 space-y-space-2">
			{#each snap.sources as s (s.n)}
				<li
					id="source-{s.n}"
					class="scroll-mt-24 rounded-sm bg-surface-sunken p-space-3 type-data target:ring-2 target:ring-signal"
				>
					<div class="flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
						<span class="font-semibold text-signal">[S{s.n}]</span>
						<span class="font-semibold text-ink">{s.tool}</span>
						<span class="text-ink-muted">{s.endpoint}</span>
						<span class="rounded-pill bg-surface-raised px-2 py-0.5 type-data-sm text-ink-muted"
							>{s.cacheHit ? 'cache hit' : 'live'}</span
						>
						<span class="text-ink-muted">{s.fetchedAt}</span>
					</div>
					<code class="mt-space-1 block break-all text-ink-muted">{s.requestKey}</code>
				</li>
			{/each}
		</ol>
	</section>

	<Card class="type-small">
		<p>
			Grounding does not prove ticket demand or commercial feasibility. Affinity is cultural overlap
			between the artist and the market, not a forecast of ticket buyers, attendance, artist fees or
			sponsor interest. The comparison is one run on one date; it is evidence of provenance, not a
			benchmark.
		</p>
	</Card>
</div>
