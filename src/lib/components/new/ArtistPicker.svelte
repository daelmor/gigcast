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
		controller = new AbortController();
		try {
			const res = await fetch(`/api/search/artists?q=${encodeURIComponent(q)}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(String(res.status));
			results = artistSearchResponseSchema.parse(await res.json()).results;
			status = 'done';
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			results = [];
			status = 'error';
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

<fieldset class="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
	<legend class="px-1 text-base font-semibold">2. Artist</legend>
	<div class="relative mt-2">
		<input
			type="text"
			bind:value={form.artist}
			oninput={onInput}
			onfocus={() => (open = results.length > 0 || status === 'loading')}
			{placeholder}
			aria-label="Artist"
			autocomplete="off"
			class="w-full rounded-lg border-0 px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600"
		/>
		{#if open}
			<div
				class="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-lg bg-white shadow-lg ring-1 ring-zinc-200"
				aria-live="polite"
			>
				{#if status === 'loading'}
					<p class="flex items-center gap-2 px-3 py-3 text-sm text-zinc-500">
						<span
							class="size-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600"
						></span>
						Searching…
					</p>
				{:else if status === 'error'}
					<p class="px-3 py-3 text-sm text-rose-700">
						Artist search is unavailable. You can still type the name and continue.
					</p>
				{:else if results.length === 0}
					<p class="px-3 py-3 text-sm text-zinc-500">
						No match. You can still continue with the name as typed.
					</p>
				{:else}
					<ul>
						{#each results as a (a.entityId)}
							<li>
								<button
									type="button"
									onclick={() => pick(a)}
									class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50"
								>
									{#if a.image}
										<img
											src={a.image}
											alt=""
											loading="lazy"
											class="size-9 shrink-0 rounded-full object-cover"
										/>
									{:else}
										<span class="size-9 shrink-0 rounded-full bg-zinc-100" aria-hidden="true"
										></span>
									{/if}
									<span class="min-w-0 flex-1">
										<span class="block truncate font-medium">{a.name}</span>
										{#if a.disambiguation}
											<span class="block truncate text-sm text-zinc-500">{a.disambiguation}</span>
										{/if}
									</span>
									{#if a.popularity != null}
										<span
											class="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100"
											title="Popularity"
										>
											<span
												class="block h-full bg-indigo-500"
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
	<p class="mt-2 text-sm text-zinc-500">
		{#if form.artistEntityId}
			Confirmed in Qloo.
		{:else if form.artist.trim()}
			Not picked from the list: the agent will look the artist up itself.
		{:else}
			Pick from the suggestions to pin the exact artist.
		{/if}
	</p>
	{#if error}<p class="mt-1 text-sm text-rose-700" role="alert">{error}</p>{/if}
</fieldset>
