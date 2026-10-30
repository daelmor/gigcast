<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BriefListItem } from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';
	import { Badge, Card, VERDICT_LABEL, VERDICT_TONE } from '$lib/components/ui';

	let { briefs }: { briefs: BriefListItem[] } = $props();

	const parse = (iso: string) => {
		const [y, m, d] = iso.split('-').map(Number);
		return { y, m, d };
	};
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	/** "Mar 5–7, 2026", "Mar 30–Apr 2, 2026" or a single day. */
	function dateWindow(b: BriefListItem): string {
		if (!b.dateFrom) return '';
		const a = parse(b.dateFrom);
		if (!a.y || !a.m || !a.d) return b.dateFrom;
		const start = `${MONTHS[a.m - 1]} ${a.d}`;
		if (!b.dateTo || b.dateTo === b.dateFrom) return `${start}, ${a.y}`;
		const e = parse(b.dateTo);
		if (!e.y || !e.m || !e.d) return `${start}, ${a.y}`;
		if (e.y !== a.y) return `${start}, ${a.y}–${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
		if (e.m !== a.m) return `${start}–${MONTHS[e.m - 1]} ${e.d}, ${a.y}`;
		return `${start}–${e.d}, ${a.y}`;
	}

	const meta = (b: BriefListItem) =>
		[findMarket(b.marketId ?? '')?.name ?? b.city, dateWindow(b)].filter(Boolean).join(' · ');
</script>

{#if briefs.length > 0}
	<section class="mt-space-7" aria-labelledby="examples-title">
		<h2 id="examples-title" class="type-heading-1">See a finished brief</h2>
		<ul class="mt-space-4 grid gap-space-5 md:grid-cols-3">
			{#each briefs as b (b.id)}
				<Card as="li" interactive class="flex flex-col">
					<div class="flex items-start justify-between gap-space-2">
						<span class="type-heading-2">{b.artistName}</span>
						{#if b.verdict}
							<Badge tone={VERDICT_TONE[b.verdict]} class="shrink-0"
								>{VERDICT_LABEL[b.verdict]}</Badge
							>
						{/if}
					</div>
					<span class="mt-space-1 type-small text-ink-muted tabular-nums">{meta(b)}</span>
					{#if b.headline}
						<p class="mt-space-3 line-clamp-2 type-body text-ink">{b.headline}</p>
					{/if}
					<a
						href={resolve('/brief/[id]', { id: b.id })}
						class="mt-auto rounded-sm pt-space-4 type-small font-semibold text-signal hover:underline"
						>Open the brief</a
					>
				</Card>
			{/each}
		</ul>
	</section>
{/if}
