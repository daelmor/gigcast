<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Map as MaplibreMap, Marker } from 'maplibre-gl';
	import BaseMap from '$lib/components/map/BaseMap.svelte';
	import { localitySearchResponseSchema, type LocalitySearchResult } from '$lib/api/contracts';
	import { FEATURED_MARKETS, KNOWN_MARKETS, findMarket, type KnownMarket } from '$lib/markets';
	import { COUNTRIES, OTHER_COUNTRY, debounce, type FormState } from './form';

	let { form, error, onpicked }: { form: FormState; error?: string; onpicked?: () => void } =
		$props();

	const others = KNOWN_MARKETS.filter((m) => !m.featured);

	let query = $state('');
	let countrySelect = $state('');
	let customCountry = $state('');
	let results = $state<LocalitySearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let point = $state<[number, number] | undefined>(
		// Initial prefill from a known market, set below by selectMarket.
		undefined
	);

	const country = $derived(countrySelect === OTHER_COUNTRY ? customCountry.trim() : countrySelect);

	let map: MaplibreMap | undefined;
	let marker: Marker | undefined;
	let controller: AbortController | undefined;

	export function selectMarket(m: KnownMarket) {
		form.marketId = m.id;
		form.city = m.name;
		form.country = m.country;
		form.localityEntityId = m.localityEntityId;
		form.localityName = m.localityName;
		point = [m.lon, m.lat];
		results = [];
		status = 'idle';
		query = '';
	}

	function selectLocality(r: LocalitySearchResult) {
		form.marketId = undefined;
		form.city = r.name;
		form.country = country || form.country;
		form.localityEntityId = r.entityId;
		form.localityName = r.name;
		point = r.lat !== undefined && r.lon !== undefined ? [r.lon, r.lat] : undefined;
		// Close the list and show the choice in the input; the next step is the artist.
		search.cancel();
		controller?.abort();
		query = r.name;
		results = [];
		status = 'idle';
		onpicked?.();
	}

	function closeResults() {
		results = [];
		if (status === 'done') status = 'idle';
	}

	const search = debounce(async (q: string, c: string) => {
		controller?.abort();
		const own = new AbortController();
		controller = own;
		// A search that never answers must not leave the spinner forever.
		const timer = setTimeout(() => own.abort(new DOMException('timeout', 'TimeoutError')), 12_000);
		status = 'loading';
		try {
			const res = await fetch(
				`/api/search/localities?q=${encodeURIComponent(q)}&country=${encodeURIComponent(c)}`,
				{ signal: own.signal }
			);
			if (!res.ok) throw new Error(String(res.status));
			results = localitySearchResponseSchema.parse(await res.json()).results;
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
		const q = query.trim();
		if (q.length < 2 || !country) {
			search.cancel();
			controller?.abort();
			results = [];
			status = 'idle';
			return;
		}
		status = 'loading';
		search(q, country);
	}

	onDestroy(() => {
		search.cancel();
		controller?.abort();
	});

	// Initial point from prefilled market.
	// svelte-ignore state_referenced_locally
	const initial = findMarket(form.marketId);
	if (initial) point = [initial.lon, initial.lat];

	async function ensureMarker() {
		if (!map) return;
		if (!point) {
			marker?.remove();
			marker = undefined;
			return;
		}
		if (marker) {
			marker.setLngLat(point);
			return;
		}
		const maplibre = await import('maplibre-gl');
		if (!map || !point) return;
		marker = new maplibre.Marker({ color: '#4f46e5' }).setLngLat(point).addTo(map);
	}

	$effect(() => {
		void point;
		ensureMarker();
	});

	function onready(m: MaplibreMap) {
		map = m;
		ensureMarker();
	}

	const chosenLabel = $derived(
		form.localityName ? `${form.localityName}${form.country ? `, ${form.country}` : ''}` : ''
	);
</script>

<fieldset class="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
	<legend class="px-1 text-base font-semibold">1. Market</legend>

	<div class="mt-2 grid gap-3 sm:grid-cols-3">
		{#each FEATURED_MARKETS as m (m.id)}
			<button
				type="button"
				onclick={() => selectMarket(m)}
				aria-pressed={form.marketId === m.id}
				class="rounded-xl p-3 text-left ring-1 transition {form.marketId === m.id
					? 'bg-indigo-50 ring-2 ring-indigo-600'
					: 'bg-white ring-zinc-200 hover:ring-indigo-400'}"
			>
				<span class="block font-medium">{m.name}</span>
				<span class="block text-sm text-zinc-500">{m.countryName}</span>
			</button>
		{/each}
	</div>
	<div class="mt-3 flex flex-wrap gap-2">
		{#each others as m (m.id)}
			<button
				type="button"
				onclick={() => selectMarket(m)}
				aria-pressed={form.marketId === m.id}
				class="rounded-full px-3 py-1 text-sm ring-1 {form.marketId === m.id
					? 'bg-indigo-600 text-white ring-indigo-600'
					: 'bg-white text-zinc-700 ring-zinc-300 hover:ring-indigo-400'}">{m.name}</button
			>
		{/each}
	</div>

	<div class="mt-5 border-t border-zinc-100 pt-4">
		<p class="text-sm font-medium text-zinc-800">Other city</p>
		<div class="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem]">
			<input
				type="text"
				bind:value={query}
				oninput={onInput}
				onkeydown={(e) => e.key === 'Escape' && closeResults()}
				placeholder="Search a city"
				aria-label="City name"
				autocomplete="off"
				class="w-full rounded-lg border-0 px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600"
			/>
			<select
				bind:value={countrySelect}
				onchange={onInput}
				aria-label="Country"
				class="w-full rounded-lg border-0 bg-white px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600"
			>
				<option value="" disabled>Country</option>
				{#each COUNTRIES as c (c.code)}
					<option value={c.code}>{c.name} ({c.code})</option>
				{/each}
				<option value={OTHER_COUNTRY}>Other</option>
			</select>
		</div>
		{#if countrySelect === OTHER_COUNTRY}
			<input
				type="text"
				bind:value={customCountry}
				oninput={onInput}
				placeholder="ISO code or country name"
				aria-label="Other country code"
				class="mt-2 w-full rounded-lg border-0 px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600 sm:w-64"
			/>
		{/if}

		<div class="mt-2 text-sm" aria-live="polite">
			{#if query.trim().length >= 2 && !country}
				<p class="text-zinc-500">Choose a country to search.</p>
			{:else if status === 'loading'}
				<p class="flex items-center gap-2 text-zinc-500">
					<span
						class="size-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600"
					></span>
					Searching…
				</p>
			{:else if status === 'error'}
				<p class="text-rose-700">
					City search is unavailable right now. Pick a market above or retry.
				</p>
			{:else if status === 'done' && results.length === 0}
				<p class="text-zinc-500">No match. Try another spelling or the local name of the city.</p>
			{/if}
		</div>

		{#if results.length > 0}
			<ul class="mt-2 divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
				{#each results as r, i (i)}
					<li>
						<button
							type="button"
							onclick={() => selectLocality(r)}
							class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-50 {r.acceptable
								? ''
								: 'opacity-55'} {form.localityEntityId === r.entityId ? 'bg-indigo-50' : ''}"
						>
							<span class="min-w-0">
								<span class="block truncate font-medium">{r.name}</span>
								{#if r.disambiguation}
									<span class="block truncate text-sm text-zinc-500">{r.disambiguation}</span>
								{/if}
							</span>
							{#if !r.acceptable}
								<span class="shrink-0 text-xs text-zinc-500">different country</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<p class="mt-4 text-sm {chosenLabel ? 'text-zinc-700' : 'text-zinc-500'}">
		{chosenLabel ? `Selected: ${chosenLabel}` : 'No market selected yet.'}
	</p>
	{#if error}<p class="mt-1 text-sm text-rose-700" role="alert">{error}</p>{/if}

	<BaseMap
		class="mt-3 h-[220px]"
		center={point ?? [-85, 15]}
		zoom={point ? 10 : 3.2}
		interactive={false}
		{onready}
		label={chosenLabel ? `Map centred on ${chosenLabel}` : 'Map of the Americas'}
	/>
</fieldset>
