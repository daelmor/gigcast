<script lang="ts">
	import Label from '../ui/Label.svelte';
	import SectionHeader from './SectionHeader.svelte';
	import { RISK_UNAVAILABLE, formatDate, words } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const risks = $derived(brief.draft.risks);
	const unavailable = $derived(!risks || risks.note.label === 'no_coverage');

	const groups = $derived(
		[...new Set((risks?.items ?? []).map((i) => i.category))].map((category) => ({
			category,
			items: (risks?.items ?? [])
				.filter((i) => i.category === category)
				.sort((a, b) => b.severity - a.severity)
		}))
	);
</script>

<section aria-labelledby="risks">
	{#if unavailable}
		<div class="mb-5 flex flex-wrap items-center gap-3">
			<h2 id="risks" class="scroll-mt-24 text-xl font-semibold text-zinc-900">Risk panel</h2>
			<Label label="no_coverage" size="md" />
		</div>
		<div class="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
			<svg
				class="mx-auto size-8 text-zinc-400"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
				/>
			</svg>
			<p class="mt-3 font-medium text-zinc-900">The risk layer is not part of this build yet</p>
			{#if risks}<p class="mx-auto mt-1 max-w-xl text-sm text-zinc-600">
					{risks.note.summary}
				</p>{/if}
			<p class="mx-auto mt-2 max-w-xl text-xs text-zinc-500">{RISK_UNAVAILABLE}</p>
		</div>
	{:else if risks}
		<SectionHeader id="risks" title="Risk panel" note={risks.note} />
		{#if groups.length === 0}
			<p class="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
				No risk items were reported.
			</p>
		{:else}
			<div class="space-y-6">
				{#each groups as group (group.category)}
					<div>
						<h3 class="mb-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
							{words(group.category)}
						</h3>
						<ul class="space-y-3">
							{#each group.items as item (item.title + item.sourceUrl)}
								<li class="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<h4 class="font-semibold text-zinc-900">{item.title}</h4>
										<span
											class="inline-flex items-center gap-0.5"
											role="img"
											aria-label="Severity {item.severity} of 5"
										>
											{#each [1, 2, 3, 4, 5] as n (n)}
												<span
													class="size-2.5 rounded-full {n <= item.severity
														? 'bg-rose-500'
														: 'bg-zinc-200'}"
												></span>
											{/each}
										</span>
									</div>
									<p class="mt-1 text-sm text-zinc-700">{item.soWhat}</p>
									<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
										<!-- eslint-disable svelte/no-navigation-without-resolve -->
										<a
											href={item.sourceUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="text-indigo-600 hover:underline">{item.sourceName}</a
										>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
										{#if item.publishedAt}
											<span class="text-zinc-500">{formatDate(item.publishedAt)}</span>
										{/if}
										<Label label={item.label} />
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</section>
