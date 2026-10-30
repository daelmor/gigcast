<script lang="ts">
	import Card from '../ui/Card.svelte';
	import EvidenceLabel from '../ui/EvidenceLabel.svelte';
	import {
		LABEL_HELP,
		type Brief,
		type BriefSection,
		type Label as LabelType
	} from '$lib/brief/schema';
	import { formatDateTime } from './format';

	let { brief }: { brief: Brief } = $props();

	const run = $derived(brief.run);
	const verification = $derived(brief.verification);

	const TITLES: Record<BriefSection, string> = {
		audience: 'Audience map',
		demandAndFit: 'Demand and fit',
		lineup: 'Lineup',
		sponsors: 'Sponsors',
		venuesAndPartners: 'Venues and partners',
		pricing: 'Pricing guidance',
		risks: 'Risk panel'
	};
	const title = (s: string) => TITLES[s as BriefSection] ?? s;
	const n = (v: number) => v.toLocaleString('en-US');

	const rows = $derived([
		['Model', run.model],
		['Status', run.status],
		['Tool calls', n(run.toolCalls)],
		['Data requests', `${n(run.qlooCalls)} (${n(run.qlooCacheHits)} cache hits)`],
		['Input tokens', n(run.usage.inputTokens)],
		['Output tokens', n(run.usage.outputTokens)],
		['Cache read tokens', n(run.usage.cacheReadInputTokens)],
		['Cache creation tokens', n(run.usage.cacheCreationInputTokens)],
		...(run.stopReason ? [['Stop reason', run.stopReason]] : []),
		['Generated', formatDateTime(brief.createdAt)]
	]);
</script>

<section aria-labelledby="method">
	<header class="mb-space-5 border-b border-line pb-space-4">
		<p class="mb-space-1 type-label text-ink-subtle">Section 10 · Method</p>
		<h2 id="method" class="scroll-mt-24 type-heading-1 text-ink">Method and sources</h2>
	</header>
	<div class="grid gap-space-4 md:grid-cols-2">
		<Card class="break-inside-avoid">
			<h3 class="type-heading-3 text-ink">Run summary</h3>
			<dl class="mt-space-2 divide-y divide-line type-small">
				{#each rows as [k, v] (k)}
					<div class="flex justify-between gap-space-4 py-space-2">
						<dt class="text-ink-muted">{k}</dt>
						<dd class="text-right text-ink tabular-nums">{v}</dd>
					</div>
				{/each}
			</dl>
			{#if run.missingSections.length > 0}
				<p class="mt-space-3 rounded-sm bg-caution-soft p-space-3 type-small text-caution">
					Missing sections: {run.missingSections.map(title).join(', ')}
				</p>
			{/if}
			{#if run.error}
				<p class="mt-space-3 rounded-sm bg-critical-soft p-space-3 type-small text-critical">
					{run.error}
				</p>
			{/if}
		</Card>

		<div class="space-y-space-4">
			<Card class="break-inside-avoid">
				<h3 class="type-heading-3 text-ink">Verification</h3>
				<p class="mt-space-1 type-body text-ink-muted">
					{verification.checked} items checked against tool results, {verification.downgraded
						.length} downgraded.
				</p>
				{#if verification.downgraded.length > 0}
					<ul class="mt-space-3 space-y-space-2 type-small">
						{#each verification.downgraded as d (d.entityId + d.section)}
							<li class="rounded-sm bg-caution-soft p-space-3">
								<p class="font-semibold text-caution">{d.name}</p>
								<p class="text-caution">{title(d.section)}: {d.reason}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
			<Card class="break-inside-avoid">
				<h3 class="type-heading-3 text-ink">Labels</h3>
				<ul class="mt-space-3 space-y-space-3 type-small text-ink-muted">
					{#each Object.entries(LABEL_HELP) as [label, help] (label)}
						<li class="flex items-start gap-space-2">
							<EvidenceLabel label={label as LabelType} class="shrink-0" />
							<span>{help}</span>
						</li>
					{/each}
				</ul>
			</Card>
		</div>
	</div>
</section>
