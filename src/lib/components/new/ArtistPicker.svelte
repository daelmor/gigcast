<script lang="ts">
	import { onDestroy } from 'svelte';
	import { artistSearchResponseSchema, type ArtistSearchResult } from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';
	import { debounce, type FormState } from './form';

	let { form, error }: { form: FormState; error?: string } = $props();

	let results = $state<ArtistSearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let open = $state(false);
	let controller: AbortController | undefined;

	const placeholder = $derived.by(() => {
		const sample = findMarket(form.marketId)?.sampleArtists[0];
		return sample ? `e.g. ${sample}` : 'Search an artist';
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

<fieldset class="bg-white ring-zinc-200 rounded-xl p-5 ring-1">
	<legend class="px-1 text-base font-semibold">2. Artist</legend>
	<div class="relative mt-2">
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
			class="ring-zinc-300 focus:ring-indigo-600 w-full rounded-lg border-0 px-3 py-2 ring-1 focus:ring-2"
		/>
		{#if open}
			<div
				class="bg-white ring-zinc-200 absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-lg shadow-lg ring-1"
				aria-live="polite"
			>
				{#if status === 'loading'}
					<p class="text-zinc-500 flex items-center gap-2 px-3 py-3 text-sm">
						<span
							class="border-zinc-300 border-t-indigo-600 size-3.5 animate-spin rounded-full border-2"
						></span>
						Searching…
					</p>
				{:else if status === 'error'}
					<p class="text-rose-700 px-3 py-3 text-sm">
						Artist search is unavailable. You can still type the name and continue.
					</p>
				{:else if results.length === 0}
					<p class="text-zinc-500 px-3 py-3 text-sm">
						No match. You can still continue with the name as typed.
					</p>
				{:else}
					<ul>
						{#each results as a, i (i)}
							<li>
								<button
									type="button"
									onpointerdown={(e) => e.preventDefault()}
									onclick={() => pick(a)}
									class="hover:bg-zinc-50 flex w-full items-center gap-3 px-3 py-2 text-left"
								>
									{#if a.image}
										<img
											src={a.image}
											alt=""
											loading="lazy"
											class="size-9 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span class="bg-zinc-100 size-9 shrink-0 rounded-full" aria-hidden="true"
										></span>
									{/if}
									<span class="min-w-0 flex-1">
										<span class="block truncate font-medium">{a.name}</span>
										{#if a.disambiguation}
											<span class="text-zinc-500 block truncate text-sm">{a.disambiguation}</span>
										{/if}
									</span>
									{#if a.popularity != null}
										<span
											class="bg-zinc-100 h-1.5 w-12 shrink-0 overflow-hidden rounded-full"
											title="Popularity"
										>
											<span
												class="bg-indigo-500 block h-full"
												style="width: {Math.round(Math.min(1, Math.max(0, a.popularity)) * 100)}%"
											></span>
										</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
	<p class="text-zinc-500 mt-2 text-sm">
		{#if form.artistEntityId}
			Confirmed in Qloo.
		{:else if form.artist.trim()}
			Not picked from the list: the agent will look the artist up itself.
		{:else}
			Pick from the suggestions to pin the exact artist.
		{/if}
	</p>
	{#if error}<p class="text-rose-700 mt-1 text-sm" role="alert">{error}</p>{/if}
</fieldset>
