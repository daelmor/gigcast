<script lang="ts">
	import { invalidateAll } from '$app/navigation';
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
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
			<p class="text-sm text-zinc-500">
				Public read-only link. Anyone with the address can read this brief.
			</p>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={copyLink}
					class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
				>
					{copied ? 'Link copied' : 'Copy link'}
				</button>
				<a
					href="{resolve('/brief/[id]/markdown', { id: record.id })}?download"
					class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
				>
					Markdown
				</a>
				<a
					href={resolve('/brief/[id]/drafts', { id: record.id })}
					class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
				>
					Drafts
				</a>
				<button
					type="button"
					onclick={() => window.print()}
					class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
				>
					Print
				</button>
				<a
					href={resolve('/new')}
					class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
				>
					New brief
				</a>
			</div>
		</div>

		<BriefDocument brief={record.brief} />

		<section class="mt-12 print:hidden" aria-labelledby="trace-heading">
			<details class="group rounded-xl bg-white ring-1 ring-zinc-200">
				<summary
					class="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-zinc-800 select-none"
				>
					<span id="trace-heading">Agent trace · {mainEvents.length} events</span>
					<span class="text-xs font-normal text-zinc-500 group-open:hidden">Show</span>
					<span class="hidden text-xs font-normal text-zinc-500 group-open:inline">Hide</span>
				</summary>
				<div class="border-t border-zinc-100 px-5 py-4">
					<RunTrace events={mainEvents} status={record.status} />
				</div>
			</details>
		</section>
	{:else if record.status === 'failed'}
		<div class="rounded-xl bg-rose-50 p-6 ring-1 ring-rose-200">
			<h1 class="text-xl font-semibold text-rose-900">This brief could not be finished</h1>
			<p class="mt-2 text-sm text-rose-800">
				{record.input.artist} in {record.input.city}, {record.input.country} · {dateWindow}
			</p>
			{#if lastError}
				<p class="mt-3 rounded-lg bg-white/70 p-3 font-mono text-xs break-words text-rose-900">
					{lastError}
				</p>
			{/if}
			<a
				href={resolve('/new')}
				class="mt-4 inline-flex rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
			>
				Start another brief
			</a>
		</div>
		{#if events.length}
			<div class="mt-8">
				<RunTrace events={mainEvents} status="failed" />
			</div>
		{/if}
	{:else}
		<header class="mb-8">
			<p class="text-sm font-medium text-indigo-600">Building the Booking Brief</p>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
				{record.input.artist} in {record.input.city}, {record.input.country}
			</h1>
			<p class="mt-2 max-w-2xl text-sm text-zinc-600">
				Date window {dateWindow}. The agent is calling Qloo and composing the document; a brief
				takes about five minutes. You can keep this page open or come back to this link later.
			</p>
			{#if stream && !stream.connected && !stream.done}
				<p class="mt-2 text-xs text-amber-700">
					{stream.error ?? 'Connecting to the live trace.'}
				</p>
			{/if}
			{#if refreshing}
				<p class="mt-2 text-xs text-zinc-500">Loading the finished brief.</p>
			{/if}
		</header>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
			<div>
				<RunProgress events={mainEvents} {status} />
				<div class="mt-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
					<div class="flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold text-zinc-900">LLM only vs. Qloo</h3>
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
											? 'animate-pulse bg-indigo-500'
											: 'bg-zinc-300'}"
								aria-hidden="true"
							></span>
							{cfState === 'pending' ? 'pending' : cfState}
						</span>
					</div>
					<p class="mt-1 text-xs text-zinc-600">{cfText[cfState]}</p>
				</div>
			</div>
			<div>
				<RunTrace events={mainEvents} live {status} />
			</div>
		</div>
	{/if}
</div>
