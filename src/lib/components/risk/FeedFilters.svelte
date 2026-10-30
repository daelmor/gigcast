<script lang="ts">
	import { DAY_OPTIONS, type FeedFilterState } from './filter';
	import { RISK_CATEGORY_LABELS, type RiskCategory } from './labels';
	import { RISK_CATEGORIES } from '$lib/brief/schema';

	interface Props {
		filters: FeedFilterState;
		/** Categories that have at least one item; others are shown disabled. */
		available?: readonly string[];
	}

	let { filters = $bindable(), available }: Props = $props();

	function toggle(c: RiskCategory) {
		filters.categories = filters.categories.includes(c)
			? filters.categories.filter((x) => x !== c)
			: [...filters.categories, c];
	}
</script>

<div class="bg-white ring-zinc-200 space-y-3 rounded-xl p-4 ring-1">
	<fieldset>
		<legend class="text-zinc-500 mb-1.5 text-xs font-semibold tracking-wide uppercase"
			>Categories</legend
		>
		<div class="flex flex-wrap gap-1.5">
			{#each RISK_CATEGORIES as c (c)}
				{@const on = filters.categories.includes(c)}
				<button
					type="button"
					aria-pressed={on}
					disabled={available ? !available.includes(c) && !on : false}
					onclick={() => toggle(c)}
					class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-40 {on
						? 'bg-indigo-600 text-white ring-indigo-600'
						: 'bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50'}"
				>
					{RISK_CATEGORY_LABELS[c]}
				</button>
			{/each}
			{#if filters.categories.length > 0}
				<button
					type="button"
					onclick={() => (filters.categories = [])}
					class="text-indigo-600 px-1 text-xs hover:underline">Clear</button
				>
			{/if}
		</div>
	</fieldset>
	<div class="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
		<label class="flex flex-col gap-1">
			<span class="text-zinc-500 text-xs font-semibold tracking-wide uppercase"
				>Minimum severity</span
			>
			<select
				bind:value={filters.minSeverity}
				class="ring-zinc-300 focus:ring-indigo-600 rounded-lg border-0 py-1.5 text-sm ring-1 focus:ring-2"
			>
				{#each [1, 2, 3, 4, 5] as n (n)}
					<option value={n}>{n}{n === 1 ? ' (all)' : '+'}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-zinc-500 text-xs font-semibold tracking-wide uppercase">Published</span>
			<select
				bind:value={filters.days}
				class="ring-zinc-300 focus:ring-indigo-600 rounded-lg border-0 py-1.5 text-sm ring-1 focus:ring-2"
			>
				{#each DAY_OPTIONS as d (d)}
					<option value={d}>Last {d} days</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 pb-1.5">
			<input
				type="checkbox"
				bind:checked={filters.mentionsSubjectOnly}
				class="text-indigo-600 focus:ring-indigo-600 size-4 rounded"
			/>
			<span class="text-zinc-700">Mentions artist or venue only</span>
		</label>
	</div>
</div>
