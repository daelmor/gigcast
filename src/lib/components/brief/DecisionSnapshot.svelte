<script lang="ts">
	import Badge from '../ui/Badge.svelte';
	import Card from '../ui/Card.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import { VERDICT_LABEL, VERDICT_TONE } from '../ui/tones';
	import SourceMarks from './SourceMarks.svelte';
	import { NOT_AVAILABLE, buildDecisionSnapshot } from '$lib/brief/snapshot';
	import { VERDICT_MEANING } from '$lib/brief/verdict';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const snap = $derived(buildDecisionSnapshot(brief));
	const row = 'sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-space-4';
</script>

<!-- A region, not a section: in print every section starts a new page and the snapshot belongs on the first page with the header. -->
<div role="region" aria-labelledby="snapshot" class="break-inside-avoid">
	<header class="mb-space-4">
		<p class="mb-space-1 type-label text-ink-subtle">Read this first</p>
		<h2 id="snapshot" class="scroll-mt-24 type-heading-1 text-ink">Decision snapshot</h2>
	</header>
	<Card>
		<dl class="space-y-space-4">
			<div class={row}>
				<dt class="type-label text-ink-subtle">Assessment</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">
					<Badge tone={VERDICT_TONE[snap.verdict]}>{VERDICT_LABEL[snap.verdict]}</Badge>
					{#if snap.headlineClause}
						<span>{snap.headlineClause}</span>
					{/if}
				</dd>
			</div>
			<div class={row}>
				<dt class="type-label text-ink-subtle">Strongest cultural signal</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">
					{snap.strongestSignal.text}
					{#if snap.strongestSignal.label}
						<EvidenceLabel label={snap.strongestSignal.label} size="sm" />
						<SourceMarks sources={snap.strongestSignal.sources} />
					{/if}
				</dd>
			</div>
			<div class={row}>
				<dt class="type-label text-ink-subtle">Top sponsor prospect</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">
					{#if snap.topSponsor}
						{snap.topSponsor.text}
						<EvidenceLabel label="grounded" size="sm" />
						<SourceMarks sources={snap.topSponsor.sources} />
					{:else}
						{NOT_AVAILABLE}
					{/if}
				</dd>
			</div>
			<div class={row}>
				<dt class="type-label text-ink-subtle">Critical unknowns</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">
					<ul class="list-disc space-y-0.5 pl-5">
						{#each snap.unknowns as u, i (i)}
							<li>{u}</li>
						{/each}
					</ul>
				</dd>
			</div>
			<div class={row}>
				<dt class="type-label text-ink-subtle">Best next step</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">{snap.nextStep}</dd>
			</div>
			<div class={row}>
				<dt class="type-label text-ink-subtle">Confidence</dt>
				<dd class="mt-space-1 type-body text-ink sm:mt-0">
					<p>{snap.confidence.culturalText}</p>
					<p class="type-small text-ink-muted">{snap.confidence.businessText}</p>
				</dd>
			</div>
		</dl>
		<p class="mt-space-3 type-small text-ink-subtle">{VERDICT_MEANING}</p>
	</Card>
</div>
