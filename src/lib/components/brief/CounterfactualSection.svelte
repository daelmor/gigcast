<script lang="ts">
	import Label from '../ui/Label.svelte';
	import { comparisonRows, matchLine, summaryLines, type MatchTone } from './counterfactual';
	import { formatDuration, pct, words } from './format';
	import type { Brief, Confidence } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const panel = $derived(brief.counterfactual);
	const draft = $derived(panel?.draft);
	const lines = $derived(panel?.summary ? summaryLines(panel.summary) : undefined);

	const confidenceStyles: Record<Confidence, string> = {
		low: 'bg-zinc-100 text-zinc-700 ring-zinc-500/25',
		medium: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		high: 'bg-indigo-50 text-indigo-800 ring-indigo-600/25'
	};
	const toneStyles: Record<MatchTone, { dot: string; text: string }> = {
		overlap: { dot: 'bg-emerald-600', text: 'font-semibold text-emerald-800' },
		in_qloo: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
		absent: { dot: 'bg-zinc-400', text: 'text-zinc-500' }
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
	<header class="mb-5">
		<h2 id="counterfactual" class="text-zinc-900 scroll-mt-24 text-xl font-semibold">
			Would this work without Qloo?
		</h2>
		<p class="text-zinc-700 mt-2 max-w-3xl text-sm leading-relaxed">
			We asked the model the same lineup and sponsor question with every data tool removed. The left
			column is what it answered from memory; the right column is what the grounded run produced
			from Qloo's results. The server checked every LLM-only name against the entities Qloo actually
			returned in this run.
		</p>
	</header>

	{#if !panel}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			This brief was built before the counterfactual run existed.
		</p>
	{:else if panel.status === 'failed'}
		<p class="bg-rose-50 text-rose-800 ring-rose-600/20 rounded-xl p-4 text-sm ring-1">
			The counterfactual run failed{panel.error ? `: ${panel.error}` : '.'}
		</p>
	{:else if panel.status === 'skipped' || !draft}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-4 text-sm ring-1">
			The counterfactual run was skipped for this brief.
		</p>
	{:else}
		{#if lines}
			<ul class="mb-6 grid gap-3 sm:grid-cols-2">
				{#each [lines.lineup, lines.sponsors] as line, i (i)}
					<li
						class="bg-indigo-50/60 text-zinc-800 ring-indigo-600/15 rounded-xl p-4 text-sm ring-1"
					>
						{line}
					</li>
				{/each}
			</ul>
		{/if}

		{#each blocks as block (block.key)}
			<div class="mb-8">
				<h3 class="text-zinc-900 mb-3 text-base font-semibold">{block.title}</h3>
				<div class="grid gap-6 md:grid-cols-2">
					<div class="space-y-3">
						<h4 class="text-zinc-500 text-xs font-semibold tracking-wide uppercase">
							LLM only (no tools)
						</h4>
						{#if block.rows.length === 0}
							<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-3 text-sm ring-1">
								The model made no picks.
							</p>
						{/if}
						<ul class="space-y-3">
							{#each block.rows as row, i (i)}
								{@const m = matchLine(row.match)}
								{@const tag = row.pick.role ? words(row.pick.role) : row.pick.category}
								<li class="bg-white ring-zinc-200 rounded-xl p-3 ring-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="text-zinc-900 font-semibold">{row.pick.name}</span>
										{#if tag}
											<span class="bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-xs"
												>{tag}</span
											>
										{/if}
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {confidenceStyles[
												row.pick.confidence
											]}">{row.pick.confidence} confidence</span
										>
									</div>
									<p class="text-zinc-700 mt-2 text-sm leading-relaxed">{row.pick.why}</p>
									<div class="mt-2 flex flex-wrap items-center gap-2">
										<Label label="inferred" />
										<span class="flex items-center gap-1.5 text-xs {toneStyles[m.tone].text}">
											<span
												class="size-1.5 shrink-0 rounded-full {toneStyles[m.tone].dot}"
												aria-hidden="true"
											></span>
											{m.text}
										</span>
									</div>
								</li>
							{/each}
						</ul>
					</div>

					<div class="space-y-3">
						<h4 class="text-zinc-500 text-xs font-semibold tracking-wide uppercase">
							Grounded in Qloo
						</h4>
						{#if block.grounded.length === 0}
							<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 rounded-xl p-3 text-sm ring-1">
								No grounded picks in this brief.
							</p>
						{/if}
						<ul class="space-y-3">
							{#each block.grounded as pick, i (i)}
								<li class="bg-white ring-zinc-200 rounded-xl p-3 ring-1">
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0">
											<span class="text-zinc-900 font-semibold">{pick.name}</span>
											{#if pick.tag}<span class="text-zinc-500 ml-1 text-xs">{pick.tag}</span>{/if}
										</div>
										{#if pick.affinity !== undefined}
											<span class="text-zinc-900 text-sm font-semibold tabular-nums">
												{pct(pick.affinity)}
											</span>
										{/if}
									</div>
									<p class="text-zinc-700 mt-1.5 line-clamp-2 text-sm">{pick.why}</p>
									<div class="mt-2"><Label label={pick.label} /></div>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		{/each}

		{#if draft.caveats.length > 0}
			<ul class="text-zinc-500 max-w-3xl list-disc space-y-0.5 pl-5 text-xs italic">
				{#each draft.caveats as caveat, i (i)}
					<li>{caveat}</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if panel}
		<p class="text-zinc-500 mt-4 text-xs">
			Counterfactual run: {panel.model}{#if tokens !== undefined}
				· {tokens.toLocaleString('en-US')} tokens{/if}{#if Number.isFinite(duration) && duration >= 0}
				· {formatDuration(duration)}{/if}
		</p>
	{/if}
</section>
