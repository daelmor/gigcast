<script lang="ts">
	import { onDestroy } from 'svelte';
	import { artistSearchResponseSchema, type ArtistSearchResult } from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';
	import Card from '$lib/components/ui/Card.svelte';
	import { debounce, type FormState } from './form';

	let { form, error }: { form: FormState; error?: string } = $props();

	let results = $state<ArtistSearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let open = $state(false);
	let controller: AbortController | undefined;

	const placeholder = $derived.by(() => {
		const sample = findMarket(form.marketId)?.sampleArtists[0];
		return sample ? `e.g. ${sample}` : 'Type an artist name';
	});

	const search = debounce(async (q: string) => {
		controller?.abort();
		const own = new AbortController();
		controller = own;
		// A search that never answers must not leave the spinner forever.
		const timer = setTimeout(() => own.abort(new DOMException('timeout', 'TimeoutError')), 12_000);
		try {
			const res = await fetch(`/api/search/artists?q=${encodeURIComponent(q)}`, {
				signal: own.signal
			});
			if (!res.ok) throw new Error(String(res.status));
			results = artistSearchResponseSchema.parse(await res.json()).results;
			status = 'done';
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			results = [];
			status = 'error';
		} finally {
			clearTimeout(timer);
		}
	}, 300);

	function onInput() {
		// Typing again invalidates a previous pick.
		form.artistEntityId = undefined;
		const q = form.artist.trim();
		if (q.length < 2) {
			search.cancel();
			controller?.abort();
			results = [];
			status = 'idle';
			open = false;
			return;
		}
		status = 'loading';
		open = true;
		search(q);
	}

	function pick(a: ArtistSearchResult) {
		form.artist = a.name;
		form.artistEntityId = a.entityId;
		open = false;
		results = [];
		status = 'idle';
	}

	onDestroy(() => {
		search.cancel();
		controller?.abort();
	});
</script>

<Card>
	<fieldset class="m-0 min-w-0 border-0 p-0">
		<legend class="px-0 type-heading-3">2. Artist</legend>
		<div class="relative mt-space-3">
			<input
				id="artist-input"
				type="text"
				bind:value={form.artist}
				oninput={onInput}
				onfocus={() => (open = results.length > 0 || status === 'loading')}
				onblur={() => (open = false)}
				onkeydown={(e) => e.key === 'Escape' && (open = false)}
				{placeholder}
				aria-label="Artist"
				autocomplete="off"
				class="w-full rounded-sm border border-line-strong bg-surface-raised px-3 py-2 type-body text-ink placeholder:text-ink-subtle"
			/>
			{#if open}
				<div
					class="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-md border border-line bg-surface-raised"
					aria-live="polite"
				>
					{#if status === 'loading'}
						<p class="flex items-center gap-2 px-3 py-3 type-small text-ink-subtle">
							<span class="size-2 animate-pulse-live rounded-full bg-beam" aria-hidden="true"
							></span>
							Searching…
						</p>
					{:else if status === 'error'}
						<p class="px-3 py-3 type-small text-critical">
							Artist search is unavailable. You can still type the name and continue.
						</p>
					{:else if results.length === 0}
						<p class="px-3 py-3 type-small text-ink-subtle">
							No match. You can still continue with the name as typed.
						</p>
					{:else}
						<ul class="divide-y divide-line">
							{#each results as a, i (i)}
								<li>
									<button
										type="button"
										onpointerdown={(e) => e.preventDefault()}
										onclick={() => pick(a)}
										class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-sunken"
									>
										{#if a.image}
											<img
												src={a.image}
												alt=""
												loading="lazy"
												class="size-9 shrink-0 rounded-full object-cover"
											/>
										{:else}
											<span
												class="size-9 shrink-0 rounded-full bg-surface-sunken"
												aria-hidden="true"
											></span>
										{/if}
										<span class="min-w-0 flex-1">
											<span class="block truncate type-body font-medium text-ink">{a.name}</span>
											{#if a.disambiguation}
												<span class="block truncate type-small text-ink-muted"
													>{a.disambiguation}</span
												>
											{/if}
										</span>
										{#if a.popularity != null}
											<span
												class="h-1.5 w-12 shrink-0 overflow-hidden rounded-pill bg-surface-sunken"
												title="Popularity"
											>
												<span
													class="block h-full bg-signal"
													style="width: {Math.round(Math.min(1, Math.max(0, a.popularity)) * 100)}%"
												></span>
											</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
						<p class="border-t border-line px-3 py-2 type-small text-ink-muted">
							Pick one to pin the exact artist.
						</p>
					{/if}
				</div>
			{/if}
		</div>
		{#if form.artistEntityId}
			<p class="mt-space-2 type-small text-ink-muted">Pinned to the exact artist.</p>
		{:else if form.artist.trim() && !open}
			<p class="mt-space-2 type-small text-ink-muted">
				Not picked from the list: the agent will look the artist up itself.
			</p>
		{/if}
		{#if error}<p class="mt-space-1 type-small text-critical" role="alert">{error}</p>{/if}
	</fieldset>
</Card>
