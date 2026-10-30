<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BriefListItem } from '$lib/api/contracts';

	// /brief/[id] is owned by another module, so its typed route is not known here yet (hence the cast).
	const briefHref = (id: string) => resolve('/brief/[id]', { id });

	let { briefs }: { briefs: BriefListItem[] } = $props();

	const verdictStyle: Record<NonNullable<BriefListItem['verdict']>, string> = {
		promising: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
		mixed: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		weak: 'bg-rose-50 text-rose-800 ring-rose-600/25',
		insufficient_data: 'bg-zinc-100 text-zinc-600 ring-zinc-500/25'
	};
	const verdictText: Record<NonNullable<BriefListItem['verdict']>, string> = {
		promising: 'Promising',
		mixed: 'Mixed',
		weak: 'Weak',
		insufficient_data: 'Insufficient data'
	};
	const statusText: Record<BriefListItem['status'], string> = {
		queued: 'Queued',
		running: 'Running',
		complete: 'Complete',
		partial: 'Partial',
		failed: 'Failed'
	};

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? ''
			: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

{#if briefs.length === 0}
	<div class="rounded-xl bg-white p-8 text-center ring-1 ring-zinc-200">
		<p class="text-zinc-600">No briefs yet. Make the first one.</p>
		<a
			href={resolve('/new')}
			class="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>New brief</a
		>
	</div>
{:else}
	<ul class="divide-y divide-zinc-200 rounded-xl bg-white ring-1 ring-zinc-200">
		{#each briefs as b (b.id)}
			<li>
				<a
					href={briefHref(b.id)}
					class="flex flex-col gap-2 px-4 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
				>
					<span class="min-w-0">
						<span class="block truncate font-medium text-zinc-900">{b.artistName}</span>
						<span class="block truncate text-sm text-zinc-500">
							{b.localityName ?? b.city}, {b.country}{b.dateFrom ? ` · ${b.dateFrom}` : ''}
						</span>
					</span>
					<span class="flex flex-wrap items-center gap-2 text-xs">
						{#if b.verdict}
							<span
								class="rounded-full px-2 py-0.5 font-medium ring-1 ring-inset {verdictStyle[
									b.verdict
								]}">{verdictText[b.verdict]}</span
							>
						{/if}
						<span class="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700"
							>{statusText[b.status]}</span
						>
						<span class="text-zinc-500">{formatDate(b.createdAt)}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
