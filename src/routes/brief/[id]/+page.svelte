<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { BriefStream } from '$lib/client/brief-stream.svelte';
	import { BriefDocument, RunProgress, RunTrace } from '$lib/components/brief';
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
	// Two runs share the stream: the main brief and the counterfactual (no tools). The trace
	// shows the main run; the counterfactual gets a status line until the document arrives.
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
	const cfState = $derived.by<'pending' | 'running' | 'done' | 'failed'>(() => {
		if (!cfRunId) return 'pending';
		const own = events.filter((e) => e.runId === cfRunId);
		if (
			own.some((e) => e.type === 'tool_call.finished' && e.tool === 'emit_counterfactual' && e.ok)
		)
			return 'done';
		if (own.some((e) => e.type === 'error' && e.fatal)) return 'failed';
		return 'running';
	});
	const cfText: Record<typeof cfState, string> = {
		pending: 'Waiting to start.',
		running: 'Answering the same lineup and sponsor question with no tools, in parallel.',
		done: 'Done. The comparison appears in the document when the brief finishes.',
		failed: 'Failed. The document will say so; the grounded brief is unaffected.'
	};
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
			.country}, grounded in Qloo."
	/>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
	{#if record.brief}
		{#if record.status === 'partial'}
			<div
				class="bg-amber-50 ring-amber-200 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ring-1 print:hidden"
			>
				<p class="text-amber-900 text-sm">
					This brief is incomplete{lastError ? `: ${lastError}` : '.'} You can run it again with the same
					inputs.
				</p>
				<button
					type="button"
					onclick={retry}
					disabled={retrying}
					class="bg-amber-700 text-white hover:bg-amber-600 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
				>
					{retrying ? 'Starting…' : 'Run this brief again'}
				</button>
				{#if retryError}<p class="text-rose-700 w-full text-sm" role="alert">{retryError}</p>{/if}
			</div>
		{/if}
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
			<p class="text-zinc-500 text-sm">
				Public read-only link. Anyone with the address can read this brief.
			</p>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={copyLink}
					class="bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 rounded-lg px-3 py-1.5 text-sm font-medium ring-1"
				>
					{copied ? 'Link copied' : 'Copy link'}
				</button>
				<a
					href="{resolve('/brief/[id]/markdown', { id: record.id })}?download"
					class="bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 rounded-lg px-3 py-1.5 text-sm font-medium ring-1"
				>
					Markdown
				</a>
				<a
					href={resolve('/brief/[id]/drafts', { id: record.id })}
					class="bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 rounded-lg px-3 py-1.5 text-sm font-medium ring-1"
				>
					Drafts
				</a>
				<button
					type="button"
					onclick={() => window.print()}
					class="bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 rounded-lg px-3 py-1.5 text-sm font-medium ring-1"
				>
					Print
				</button>
				<a
					href={resolve('/new')}
					class="bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg px-3 py-1.5 text-sm font-medium"
				>
					New brief
				</a>
			</div>
		</div>

		<BriefDocument brief={record.brief} />

		<section class="mt-12 print:hidden" aria-labelledby="trace-heading">
			<details class="group bg-white ring-zinc-200 rounded-xl ring-1">
				<summary
					class="text-zinc-800 flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold select-none"
				>
					<span id="trace-heading">Agent trace · {mainEvents.length} events</span>
					<span class="text-zinc-500 text-xs font-normal group-open:hidden">Show</span>
					<span class="text-zinc-500 hidden text-xs font-normal group-open:inline">Hide</span>
				</summary>
				<div class="border-zinc-100 border-t px-5 py-4">
					<RunTrace events={mainEvents} status={record.status} />
				</div>
			</details>
		</section>
	{:else if record.status === 'failed'}
		<div class="bg-rose-50 ring-rose-200 rounded-xl p-6 ring-1">
			<h1 class="text-rose-900 text-xl font-semibold">This brief could not be finished</h1>
			<p class="text-rose-800 mt-2 text-sm">
				{record.input.artist} in {record.input.city}, {record.input.country} · {dateWindow}
			</p>
			{#if lastError}
				<p class="bg-white/70 text-rose-900 mt-3 rounded-lg p-3 font-mono text-xs break-words">
					{lastError}
				</p>
			{/if}
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={retry}
					disabled={retrying}
					class="bg-rose-700 text-white hover:bg-rose-600 inline-flex rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
				>
					{retrying ? 'Starting…' : 'Run this brief again'}
				</button>
				<a href={resolve('/new')} class="text-rose-800 text-sm font-medium hover:underline">
					Start a different brief
				</a>
			</div>
			{#if retryError}<p class="text-rose-700 mt-2 text-sm" role="alert">{retryError}</p>{/if}
		</div>
		{#if events.length}
			<div class="mt-8">
				<RunTrace events={mainEvents} status="failed" />
			</div>
		{/if}
	{:else}
		<header class="mb-8">
			<p class="text-indigo-600 text-sm font-medium">Building the Booking Brief</p>
			<h1 class="text-zinc-900 mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
				{record.input.artist} in {record.input.city}, {record.input.country}
			</h1>
			<p class="text-zinc-600 mt-2 max-w-2xl text-sm">
				Date window {dateWindow}. The agent is calling Qloo and composing the document; a brief
				takes about five minutes. You can keep this page open or come back to this link later.
			</p>
			{#if stream && !stream.connected && !stream.done}
				<p class="text-amber-700 mt-2 text-xs">
					{stream.error ?? 'Connecting to the live trace.'}
				</p>
			{/if}
			{#if refreshing}
				<p class="text-zinc-500 mt-2 text-xs">Loading the finished brief.</p>
			{/if}
		</header>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
			<div>
				<RunProgress events={mainEvents} {status} />
				<div class="bg-white ring-zinc-200 mt-4 rounded-xl p-4 ring-1">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-zinc-900 text-sm font-semibold">LLM only vs. Qloo</h3>
						<span
							class="inline-flex items-center gap-1.5 text-xs font-medium {cfState === 'done'
								? 'text-emerald-700'
								: cfState === 'failed'
									? 'text-rose-700'
									: 'text-indigo-700'}"
						>
							<span
								class="size-2 rounded-full {cfState === 'done'
									? 'bg-emerald-500'
									: cfState === 'failed'
										? 'bg-rose-500'
										: cfState === 'running'
											? 'bg-indigo-500 animate-pulse'
											: 'bg-zinc-300'}"
								aria-hidden="true"
							></span>
							{cfState === 'pending' ? 'pending' : cfState}
						</span>
					</div>
					<p class="text-zinc-600 mt-1 text-xs">{cfText[cfState]}</p>
				</div>
			</div>
			<div>
				<RunTrace events={mainEvents} live {status} />
			</div>
		</div>
	{/if}
</div>
