<script lang="ts">
	import Label from '../ui/Label.svelte';
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
		['Qloo calls', `${n(run.qlooCalls)} (${n(run.qlooCacheHits)} cache hits)`],
		['Input tokens', n(run.usage.inputTokens)],
		['Output tokens', n(run.usage.outputTokens)],
		['Cache read tokens', n(run.usage.cacheReadInputTokens)],
		['Cache creation tokens', n(run.usage.cacheCreationInputTokens)],
		...(run.stopReason ? [['Stop reason', run.stopReason]] : []),
		['Generated', formatDateTime(brief.createdAt)]
	]);
</script>

<section aria-labelledby="method">
	<h2 id="method" class="text-zinc-900 mb-4 scroll-mt-24 text-xl font-semibold">
		Method and sources
	</h2>
	<div class="grid gap-4 md:grid-cols-2">
		<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
			<h3 class="text-zinc-900 text-sm font-semibold">Run summary</h3>
			<dl class="divide-zinc-100 mt-2 divide-y text-sm">
				{#each rows as [k, v] (k)}
					<div class="flex justify-between gap-4 py-1.5">
						<dt class="text-zinc-500">{k}</dt>
						<dd class="text-zinc-900 text-right tabular-nums">{v}</dd>
					</div>
				{/each}
			</dl>
			{#if run.missingSections.length > 0}
				<p class="text-amber-800 mt-3 text-sm">
					Missing sections: {run.missingSections.map(title).join(', ')}
				</p>
			{/if}
			{#if run.error}
				<p class="bg-rose-50 text-rose-800 ring-rose-200 mt-3 rounded-lg p-3 text-sm ring-1">
					{run.error}
				</p>
			{/if}
		</div>

		<div class="space-y-4">
			<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
				<h3 class="text-zinc-900 text-sm font-semibold">Verification</h3>
				<p class="text-zinc-700 mt-1 text-sm">
					{verification.checked} items checked against tool results, {verification.downgraded
						.length} downgraded.
				</p>
				{#if verification.downgraded.length > 0}
					<ul class="mt-2 space-y-2 text-sm">
						{#each verification.downgraded as d (d.entityId + d.section)}
							<li class="bg-amber-50 ring-amber-200 rounded-lg p-3 ring-1">
								<p class="text-amber-900 font-medium">{d.name}</p>
								<p class="text-amber-800 text-xs">{title(d.section)}: {d.reason}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div class="bg-white ring-zinc-200 rounded-xl p-4 ring-1">
				<h3 class="text-zinc-900 text-sm font-semibold">Labels</h3>
				<ul class="text-zinc-600 mt-2 space-y-2 text-sm">
					{#each Object.entries(LABEL_HELP) as [label, help] (label)}
						<li class="flex items-start gap-2">
							<Label label={label as LabelType} class="shrink-0" />
							<span>{help}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</section>
