<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { BriefStream } from '$lib/client/brief-stream.svelte';
	import { BriefDocument, RunProgress, RunTrace } from '$lib/components/brief';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const record = $derived(data.record);
	const terminal = $derived(
		record.status === 'complete' || record.status === 'partial' || record.status === 'failed'
	);

	let stream = $state<BriefStream>();
	let refreshing = $state(false);
	let copied = $state(false);

	onMount(() => {
		if (terminal) return;
		const s = new BriefStream(record.id, record.events, record.status, record.lastEventId);
		s.ondone = async () => {
			refreshing = true;
			try {
				await invalidateAll();
			} finally {
				refreshing = false;
			}
		};
		s.start();
		stream = s;
		return () => s.stop();
	});

	$effect(() => {
		if (terminal && stream) stream.stop();
	});

	const events = $derived(stream && !terminal ? stream.events : record.events);
	const status = $derived(stream && !terminal ? stream.status : record.status);
	// Two runs share the stream: the main brief and a second, tool-less run the document does
	// not show. The trace follows the main run only.
	const mainRunId = $derived(
		events.find((e) => e.type === 'run.started' && e.kind === 'main')?.runId
	);
	const cfRunId = $derived(
		events.find((e) => e.type === 'run.started' && e.kind === 'counterfactual')?.runId
	);
	const mainEvents = $derived(
		mainRunId
			? events.filter((e) => e.runId === mainRunId)
			: events.filter((e) => e.runId !== cfRunId)
	);
	const lastError = $derived(
		record.runs
			.map((r) => r.error)
			.filter(Boolean)
			.at(-1) ?? null
	);
	const title = $derived(
		record.brief?.draft.headline ?? `${record.input.artist} in ${record.input.city}`
	);
	const dateWindow = $derived(
		record.input.dateFrom === record.input.dateTo
			? record.input.dateFrom
			: `${record.input.dateFrom} to ${record.input.dateTo}`
	);

	// Open every <details> for printing (drafts, trace) and restore them afterwards.
	let reopened: HTMLDetailsElement[] = [];
	function openAllDetails() {
		reopened = [...document.querySelectorAll<HTMLDetailsElement>('details:not([open])')];
		for (const d of reopened) d.open = true;
	}
	function restoreDetails() {
		for (const d of reopened) d.open = false;
		reopened = [];
	}

	// Partial or failed briefs (for example a redeploy that interrupted the agent) can be rerun
	// with the same inputs; the new brief gets its own link.
	let retrying = $state(false);
	let retryError = $state<string | undefined>();
	async function retry() {
		retrying = true;
		retryError = undefined;
		try {
			const res = await fetch('/api/briefs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...record.input, marketId: record.marketId ?? undefined })
			});
			if (res.status === 429) {
				retryError = 'The agent is busy with other briefs right now. Try again in a few minutes.';
				return;
			}
			if (!res.ok) {
				retryError = `The brief could not be started (HTTP ${res.status}).`;
				return;
			}
			const { id } = (await res.json()) as { id: string };
			await goto(resolve('/brief/[id]', { id }));
		} catch {
			retryError = 'The brief could not be started. Check your connection and try again.';
		} finally {
			retrying = false;
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard unavailable (insecure context or denied); the address bar still works.
		}
	}
</script>

<svelte:window onbeforeprint={openAllDetails} onafterprint={restoreDetails} />

<svelte:head>
	<title>{title} · gigcast</title>
	<meta
		name="description"
		content="Booking Brief for {record.input.artist} in {record.input.city}, {record.input
			.country}, grounded in cultural data."
	/>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-space-6 sm:px-6">
	{#if record.brief}
		{#if record.status === 'partial'}
			<div
				class="mb-space-4 flex flex-wrap items-center justify-between gap-space-3 rounded-lg bg-caution-soft p-space-4 print:hidden"
			>
				<p class="type-small text-caution">
					This brief is incomplete{lastError ? `: ${lastError}` : '.'} You can run it again with the same
					inputs.
				</p>
				<Button size="sm" onclick={retry} disabled={retrying}>
					{retrying ? 'Starting…' : 'Run this brief again'}
				</Button>
				{#if retryError}<p class="w-full type-small font-semibold text-critical" role="alert">
						{retryError}
					</p>{/if}
			</div>
		{/if}
		<div class="mb-space-5 flex flex-wrap items-center justify-between gap-space-3 print:hidden">
			<p class="type-small text-ink-subtle">
				Public read-only link. Anyone with the address can read this brief.
			</p>
			<div class="flex flex-wrap items-center gap-space-2">
				<Button variant="ghost" size="sm" onclick={copyLink}>
					{copied ? 'Link copied' : 'Copy link'}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					href="{resolve('/brief/[id]/markdown', { id: record.id })}?download"
				>
					Markdown
				</Button>
				<Button variant="ghost" size="sm" href={resolve('/brief/[id]/drafts', { id: record.id })}>
					Drafts
				</Button>
				<Button variant="ghost" size="sm" onclick={() => window.print()}>Print</Button>
				<Button variant="primary" size="sm" href={resolve('/new')}>New brief</Button>
			</div>
		</div>

		<BriefDocument brief={record.brief} />

		<section class="mt-space-7 print:hidden" aria-labelledby="trace-heading">
			<Card padded={false}>
				<details class="group">
					<summary
						class="flex cursor-pointer items-center justify-between gap-space-3 px-space-5 py-space-4 type-small font-semibold text-ink select-none"
					>
						<span id="trace-heading">Agent trace · {mainEvents.length} events</span>
						<span class="type-small font-normal text-ink-subtle group-open:hidden">Show</span>
						<span class="hidden type-small font-normal text-ink-subtle group-open:inline">Hide</span
						>
					</summary>
					<div class="border-t border-line px-space-5 py-space-4">
						<RunTrace events={mainEvents} status={record.status} />
					</div>
				</details>
			</Card>
		</section>
	{:else if record.status === 'failed'}
		<div class="rounded-lg bg-critical-soft p-space-5">
			<h1 class="type-heading-1 text-critical">This brief could not be finished</h1>
			<p class="mt-space-2 type-body text-critical">
				{record.input.artist} in {record.input.city}, {record.input.country} · {dateWindow}
			</p>
			{#if lastError}
				<p class="mt-space-3 rounded-sm bg-surface-raised p-space-3 type-data break-words text-ink">
					{lastError}
				</p>
			{/if}
			<div class="mt-space-4 flex flex-wrap items-center gap-space-3">
				<Button variant="primary" onclick={retry} disabled={retrying}>
					{retrying ? 'Starting…' : 'Run this brief again'}
				</Button>
				<Button variant="ghost" href={resolve('/new')}>Start a different brief</Button>
			</div>
			{#if retryError}<p class="mt-space-2 type-small font-semibold text-critical" role="alert">
					{retryError}
				</p>{/if}
		</div>
		{#if events.length}
			<div class="mt-space-6">
				<RunTrace events={mainEvents} status="failed" />
			</div>
		{/if}
	{:else}
		<header class="mb-space-6">
			<div class="flex flex-wrap items-center gap-space-3">
				<p class="type-label text-ink-subtle">Building the Booking Brief</p>
				{#if status === 'running'}<Badge tone="live">Running</Badge>{/if}
			</div>
			<h1 class="mt-space-2 type-heading-1 text-ink sm:type-display">
				{record.input.artist} in {record.input.city}, {record.input.country}
			</h1>
			<p class="mt-space-3 max-w-2xl type-body text-ink-muted">
				Date window {dateWindow}. The agent is querying the taste graph and composing the document;
				a brief takes about five minutes. You can keep this page open or come back to this link
				later.
			</p>
			{#if stream && !stream.connected && !stream.done}
				<p class="mt-space-2 type-small text-caution">
					{stream.error ?? 'Connecting to the live trace.'}
				</p>
			{/if}
			{#if refreshing}
				<p class="mt-space-2 type-small text-ink-subtle">Loading the finished brief.</p>
			{/if}
		</header>

		<div class="grid gap-space-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
			<div>
				<RunProgress events={mainEvents} {status} />
			</div>
			<div>
				<RunTrace events={mainEvents} live {status} />
			</div>
		</div>
	{/if}
</div>
