<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Map as MaplibreMap, Marker } from 'maplibre-gl';
	import Card from '$lib/components/ui/Card.svelte';
	import BaseMap from '$lib/components/map/BaseMap.svelte';
	import { theme } from '$lib/client/theme-colors.svelte';
	import { localitySearchResponseSchema, type LocalitySearchResult } from '$lib/api/contracts';
	import { FEATURED_MARKETS, findMarket, type KnownMarket } from '$lib/markets';
	import { debounce, type FormState } from './form';

	let { form, error, onpicked }: { form: FormState; error?: string; onpicked?: () => void } =
		$props();

	const field =
		'rounded-sm border border-line-strong bg-surface-raised px-3 py-2 type-body text-ink placeholder:text-ink-subtle';

	let query = $state('');
	let results = $state<LocalitySearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let point = $state<[number, number] | undefined>(
		// Initial prefill from a known market, set below by selectMarket.
		undefined
	);

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

	/** The country as the search result states it: the ISO code when known, else the last segment of the disambiguation. */
	function countryOf(r: LocalitySearchResult): string {
		if (r.countryCode) return r.countryCode;
		const last = r.disambiguation?.split(',').pop()?.trim();
		return last && last.length >= 2 ? last : '';
	}

	function selectLocality(r: LocalitySearchResult) {
		form.marketId = undefined;
		form.city = r.name;
		form.country = countryOf(r) || form.country;
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

	const search = debounce(async (q: string) => {
		controller?.abort();
		const own = new AbortController();
		controller = own;
		// A search that never answers must not leave the spinner forever.
		const timer = setTimeout(() => own.abort(new DOMException('timeout', 'TimeoutError')), 12_000);
		status = 'loading';
		try {
			const res = await fetch(`/api/search/localities?q=${encodeURIComponent(q)}`, {
				signal: own.signal
			});
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
		if (q.length < 2) {
			search.cancel();
			controller?.abort();
			results = [];
			status = 'idle';
			return;
		}
		status = 'loading';
		search(q);
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
		marker = new maplibre.Marker({ color: theme.colors.action }).setLngLat(point).addTo(map);
	}

	$effect(() => {
		void point;
		ensureMarker();
	});

	function onready(m: MaplibreMap) {
		map = m;
		marker?.remove();
		marker = undefined;
		ensureMarker();
	}

	// The marker is a DOM element with a baked-in colour; rebuild it when the theme changes.
	$effect(() => {
		void theme.version;
		if (!map) return;
		marker?.remove();
		marker = undefined;
		ensureMarker();
	});

	const chosenLabel = $derived(
		form.localityName ? `${form.localityName}${form.country ? `, ${form.country}` : ''}` : ''
	);
</script>

<Card>
	<fieldset class="m-0 min-w-0 border-0 p-0">
		<legend class="px-0 type-heading-3">1. Market</legend>

		<div class="mt-space-3 grid gap-space-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each FEATURED_MARKETS as m (m.id)}
				<Card
					interactive
					padded={false}
					class={form.marketId === m.id ? 'bg-signal-soft ring-1 ring-signal' : ''}
				>
					<button
						type="button"
						onclick={() => selectMarket(m)}
						aria-pressed={form.marketId === m.id}
						class="block w-full rounded-lg p-space-3 text-left"
					>
						<span class="block type-body font-semibold text-ink">{m.name}</span>
						<span class="block type-small text-ink-muted">{m.countryName}</span>
					</button>
				</Card>
			{/each}
		</div>

		<div class="mt-space-5 border-t border-line pt-space-4">
			<p class="type-label text-ink-subtle">Other city</p>
			<input
				type="text"
				bind:value={query}
				oninput={onInput}
				onkeydown={(e) => e.key === 'Escape' && closeResults()}
				placeholder="Search a city"
				aria-label="City name"
				autocomplete="off"
				class="{field} mt-2 w-full"
			/>

			<div class="mt-2 type-small" aria-live="polite">
				{#if status === 'loading'}
					<p class="flex items-center gap-2 text-ink-subtle">
						<span class="size-2 animate-pulse-live rounded-full bg-beam" aria-hidden="true"></span>
						Searching…
					</p>
				{:else if status === 'error'}
					<p class="text-critical">
						City search is unavailable right now. Pick a market above or retry.
					</p>
				{:else if status === 'done' && results.length === 0}
					<p class="text-ink-subtle">
						No match. Try another spelling or the local name of the city.
					</p>
				{/if}
			</div>

			{#if results.length > 0}
				<ul
					class="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-raised"
				>
					{#each results as r, i (i)}
						<li>
							<button
								type="button"
								onclick={() => selectLocality(r)}
								class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-sunken {form.localityEntityId ===
								r.entityId
									? 'bg-signal-soft'
									: ''}"
							>
								<span class="min-w-0">
									<span class="block truncate type-body font-medium text-ink">{r.name}</span>
									{#if r.disambiguation}
										<span class="block truncate type-small text-ink-muted">{r.disambiguation}</span>
									{/if}
								</span>
								{#if r.countryCode}
									<span class="shrink-0 type-data-sm text-ink-muted">{r.countryCode}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<p class="mt-space-4 type-small {chosenLabel ? 'text-ink' : 'text-ink-muted'}">
			{chosenLabel ? `Selected: ${chosenLabel}` : 'No market selected yet.'}
		</p>
		{#if error}<p class="mt-space-1 type-small text-critical" role="alert">{error}</p>{/if}

		<BaseMap
			class="mt-3 h-[220px]"
			center={point ?? [-78, 8]}
			zoom={point ? 10 : 1.9}
			interactive={false}
			{onready}
			label={chosenLabel ? `Map centred on ${chosenLabel}` : 'Map of the Americas'}
		/>
	</fieldset>
</Card>
