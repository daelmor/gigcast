<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BriefListItem } from '$lib/api/contracts';
	import {
		Badge,
		Button,
		Card,
		STATUS_LABEL,
		STATUS_TONE,
		VERDICT_LABEL,
		VERDICT_TONE
	} from '$lib/components/ui';

	// /brief/[id] is owned by another module, so its typed route is not known here yet (hence the cast).
	const briefHref = (id: string) => resolve('/brief/[id]', { id });

	let { briefs }: { briefs: BriefListItem[] } = $props();

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? ''
			: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

{#if briefs.length === 0}
	<Card class="text-center">
		<p class="type-body text-ink-muted">No briefs yet. Make the first one.</p>
		<Button href={resolve('/new')} class="mt-space-4">New brief</Button>
	</Card>
{:else}
	<ul class="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
		{#each briefs as b (b.id)}
			<li>
				<a
					href={briefHref(b.id)}
					class="flex flex-col gap-space-2 px-space-4 py-space-3 text-ink no-underline transition-colors duration-[120ms] hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between sm:gap-space-4"
				>
					<span class="min-w-0">
						<span class="block truncate type-body font-semibold">{b.artistName}</span>
						<span class="block truncate type-small text-ink-muted">
							{b.localityName ?? b.city}, {b.country}{b.dateFrom ? ` · ${b.dateFrom}` : ''}
						</span>
					</span>
					<span class="flex flex-wrap items-center gap-space-2 type-small">
						{#if b.verdict}
							<Badge tone={VERDICT_TONE[b.verdict]}>{VERDICT_LABEL[b.verdict]}</Badge>
						{/if}
						<Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
						<span class="text-ink-muted tabular-nums sm:w-28 sm:text-right"
							>{formatDate(b.createdAt)}</span
						>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
