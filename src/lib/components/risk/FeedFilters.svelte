<script lang="ts">
	import Card from '../ui/Card.svelte';
	import Chip from '../ui/Chip.svelte';
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

	const select =
		'rounded-sm border border-line-strong bg-surface-raised px-3 py-2 type-body text-ink';
</script>

<Card class="space-y-space-3">
	<fieldset>
		<legend class="mb-space-2 type-label text-ink-subtle">Categories</legend>
		<div class="flex flex-wrap items-center gap-space-2">
			{#each RISK_CATEGORIES as c (c)}
				{@const on = filters.categories.includes(c)}
				<Chip
					pressed={on}
					disabled={available ? !available.includes(c) && !on : false}
					onclick={() => toggle(c)}
				>
					{RISK_CATEGORY_LABELS[c]}
				</Chip>
			{/each}
			{#if filters.categories.length > 0}
				<button
					type="button"
					onclick={() => (filters.categories = [])}
					class="px-1 type-small text-signal hover:underline">Clear</button
				>
			{/if}
		</div>
	</fieldset>
	<div class="flex flex-wrap items-end gap-x-6 gap-y-3">
		<label class="flex flex-col gap-1">
			<span class="type-label text-ink-subtle">Minimum severity</span>
			<select bind:value={filters.minSeverity} class={select}>
				{#each [1, 2, 3, 4, 5] as n (n)}
					<option value={n}>{n}{n === 1 ? ' (all)' : '+'}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1">
			<span class="type-label text-ink-subtle">Published</span>
			<select bind:value={filters.days} class={select}>
				{#each DAY_OPTIONS as d (d)}
					<option value={d}>Last {d} days</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 pb-2">
			<input
				type="checkbox"
				bind:checked={filters.mentionsSubjectOnly}
				class="size-4 rounded-sm accent-action"
			/>
			<span class="type-small text-ink">Mentions artist or venue only</span>
		</label>
	</div>
</Card>
