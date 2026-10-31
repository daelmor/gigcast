<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Card, STATUS_LABEL, STATUS_TONE, type RunStatus } from '$lib/components/ui';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const stats = $derived(data.stats);

	const nf = new Intl.NumberFormat('en-US');
	const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
	const shortTime = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });

	const WINDOW_LABEL: Record<string, string> = {
		'24h': 'Last 24 hours',
		'7d': 'Last 7 days',
		'30d': 'Last 30 days'
	};

	const num = (n: number | null) => (n == null ? '–' : nf.format(Math.round(n)));
	const secs = (n: number | null) => {
		if (n == null) return '–';
		const s = Math.max(0, Math.round(n));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};
	const k = (n: number | null) => {
		if (n == null) return '–';
		return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
	};
	const pct = (r: number | null) => (r == null ? '–' : `${Math.round(r * 100)}%`);
	const truncate = (s: string, max = 80) => (s.length > max ? `${s.slice(0, max)}…` : s);
	const isStatus = (s: string): s is RunStatus => s in STATUS_TONE;

	const runTiles = $derived([
		{ label: 'Finished runs', value: num(stats.runs.count), sub: '' },
		{ label: 'Median duration', value: secs(stats.runs.medianSec), sub: '' },
		{ label: 'p90 duration', value: secs(stats.runs.p90Sec), sub: '' },
		{
			label: 'Avg input',
			value: k(stats.runs.avgInputTokens),
			sub:
				stats.runs.avgCacheReadInputTokens == null
					? ''
					: `+ ${k(stats.runs.avgCacheReadInputTokens)} cached`
		},
		{ label: 'Avg output', value: k(stats.runs.avgOutputTokens), sub: '' },
		{ label: 'Avg tool calls', value: num(stats.runs.avgToolCalls), sub: '' },
		{ label: 'Avg Qloo requests', value: num(stats.runs.avgQlooCalls), sub: '' },
		{ label: 'Cache hit rate', value: pct(stats.runs.cacheHitRate), sub: '' }
	]);

	const lists = $derived([
		{
			title: 'Top pages (7 days)',
			rows: stats.topPaths.map((r) => ({ text: r.path, hits: r.hits }))
		},
		{
			title: 'Referrers (7 days)',
			rows: stats.referrers.map((r) => ({ text: r.host, hits: r.hits }))
		},
		{
			title: '404 paths (7 days)',
			rows: stats.notFound.map((r) => ({ text: r.path, hits: r.hits }))
		}
	]);

	const th = 'px-space-4 py-space-2 font-semibold';
	const thr = `${th} text-right`;
	const td = 'px-space-4 py-space-3';
	const tdr = `${td} text-right tabular-nums`;
</script>

<svelte:head>
	<title>Activity · gigcast</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div>
	<header>
		<h1 class="type-heading-1 text-ink">Activity</h1>
		<p class="mt-space-1 type-small text-ink-subtle">
			Generated {dateTime.format(new Date(stats.generatedAt))}
		</p>
		<p class="mt-space-2 flex flex-wrap items-center gap-space-2 type-small text-ink-muted">
			<Badge tone={stats.live.running > 0 ? 'live' : 'neutral'}>
				{stats.live.running > 0 ? 'Live' : 'Idle'}
			</Badge>
			<span class="tabular-nums">
				{stats.live.running} running · {stats.live.queued} waiting · limits {stats.live.limit} / {stats
					.live.queueLimit}
			</span>
		</p>
	</header>

	<section class="mt-space-6 grid gap-space-4 md:grid-cols-3" aria-label="Windows">
		{#each stats.windows as w (w.label)}
			<Card as="section">
				<h2 class="type-heading-3 text-ink">{WINDOW_LABEL[w.label] ?? w.label}</h2>
				<p class="mt-space-2 text-ink">
					<span class="type-data text-4xl font-semibold tabular-nums">{nf.format(w.briefs)}</span>
					<span class="type-small text-ink-muted">briefs</span>
				</p>
				<p class="type-small text-ink-subtle tabular-nums">
					{w.complete} complete · {w.partial} partial · {w.failed} failed
				</p>
				<dl class="mt-space-3 divide-y divide-line type-small">
					{#each [['Visitors', w.visitors], ['Page views', w.views], ['Bot hits', w.botHits], ['Refused (429)', w.refused]] as [label, value] (label)}
						<div class="flex justify-between py-space-1">
							<dt class="text-ink-muted">{label}</dt>
							<dd class="text-ink tabular-nums">{nf.format(Number(value))}</dd>
						</div>
					{/each}
				</dl>
			</Card>
		{/each}
	</section>

	<Card as="section" class="mt-space-4">
		<h2 class="type-heading-3 text-ink">Runs (last 30 days)</h2>
		<div class="mt-space-3 grid grid-cols-2 gap-space-3 sm:grid-cols-4">
			{#each runTiles as t (t.label)}
				<div class="rounded-lg bg-surface-sunken p-space-3">
					<p class="type-small text-ink-muted">{t.label}</p>
					<p class="type-data text-xl font-semibold text-ink tabular-nums">{t.value}</p>
					{#if t.sub}<p class="type-small text-ink-subtle tabular-nums">{t.sub}</p>{/if}
				</div>
			{/each}
		</div>
	</Card>

	<section class="mt-space-6">
		<h2 class="type-heading-3 text-ink">Last 14 days</h2>
		<Card padded={false} class="mt-space-2">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[24rem] text-left type-small">
					<thead class="border-b border-line bg-surface-sunken type-label text-ink-muted">
						<tr>
							<th class={th}>Day</th><th class={thr}>Briefs</th><th class={thr}>Visitors</th><th
								class={thr}>Views</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each stats.days as d (d.day)}
							<tr>
								<td class="{td} text-ink tabular-nums">{d.day}</td>
								<td class="{tdr} text-ink">{nf.format(d.briefs)}</td>
								<td class="{tdr} text-ink">{nf.format(d.visitors)}</td>
								<td class="{tdr} text-ink">{nf.format(d.views)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<section class="mt-space-6">
		<h2 class="type-heading-3 text-ink">Recent briefs</h2>
		<Card padded={false} class="mt-space-2">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[62rem] text-left type-small">
					<thead class="border-b border-line bg-surface-sunken type-label text-ink-muted">
						<tr>
							<th class={th}>Brief</th>
							<th class={th}>Status</th>
							<th class={th}>Created</th>
							<th class={thr}>Wait</th>
							<th class={thr}>Run</th>
							<th class={thr}>Input</th>
							<th class={thr}>Cached</th>
							<th class={thr}>Output</th>
							<th class={thr}>Tools</th>
							<th class={thr}>Qloo</th>
							<th class={thr}>Qloo cache</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each stats.recentBriefs as b (b.id)}
							{@const created = new Date(b.createdAt)}
							<tr class="align-top">
								<td class="{td} text-ink">
									<a
										href={resolve('/brief/[id]', { id: b.id })}
										class="font-semibold text-signal underline-offset-2 hover:underline"
										>{b.artistName}</a
									>
									<span class="text-ink-muted">{b.city}</span>
									{#if b.error}
										<p class="mt-space-1 text-critical">{truncate(b.error)}</p>
									{/if}
								</td>
								<td class={td}>
									{#if isStatus(b.status)}
										<Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
									{:else}
										<Badge tone="neutral">{b.status}</Badge>
									{/if}
								</td>
								<td class="{td} whitespace-nowrap text-ink-muted tabular-nums">
									{shortDate.format(created)}, {shortTime.format(created)}
								</td>
								<td class="{tdr} text-ink">{secs(b.waitedSec)}</td>
								<td class="{tdr} text-ink">{secs(b.durationSec)}</td>
								<td class="{tdr} text-ink">{k(b.inputTokens)}</td>
								<td class="{tdr} text-ink">{k(b.cacheReadInputTokens)}</td>
								<td class="{tdr} text-ink">{k(b.outputTokens)}</td>
								<td class="{tdr} text-ink">{b.toolCalls}</td>
								<td class="{tdr} text-ink">{b.qlooCalls}</td>
								<td class="{tdr} text-ink">{b.qlooCacheHits}</td>
							</tr>
						{:else}
							<tr><td class="{td} text-ink-muted" colspan="11">Nothing yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<section class="mt-space-6">
		<h2 class="type-heading-3 text-ink">Markets (last 30 days)</h2>
		<Card padded={false} class="mt-space-2">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[20rem] text-left type-small">
					<thead class="border-b border-line bg-surface-sunken type-label text-ink-muted">
						<tr
							><th class={th}>Market</th><th class={thr}>Briefs</th><th class={thr}>Complete</th
							></tr
						>
					</thead>
					<tbody class="divide-y divide-line">
						{#each stats.markets as m (m.marketId ?? m.name)}
							<tr>
								<td class="{td} text-ink">{m.name}</td>
								<td class="{tdr} text-ink">{nf.format(m.briefs)}</td>
								<td class="{tdr} text-ink">{nf.format(m.complete)}</td>
							</tr>
						{:else}
							<tr><td class="{td} text-ink-muted" colspan="3">Nothing yet.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<section class="mt-space-6 grid gap-space-4 md:grid-cols-3" aria-label="Traffic">
		{#each lists as list (list.title)}
			<Card as="section">
				<h2 class="type-heading-3 text-ink">{list.title}</h2>
				{#if list.rows.length === 0}
					<p class="mt-space-2 type-small text-ink-muted">Nothing yet.</p>
				{:else}
					<ul class="mt-space-2 divide-y divide-line type-small">
						{#each list.rows as r, i (i)}
							<li class="flex justify-between gap-space-3 py-space-1">
								<span class="min-w-0 break-all text-ink">{r.text}</span>
								<span class="text-ink-muted tabular-nums">{nf.format(r.hits)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		{/each}
	</section>
</div>
