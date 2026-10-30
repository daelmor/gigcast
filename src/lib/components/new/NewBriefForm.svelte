<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		apiErrorSchema,
		createBriefRequestSchema,
		createBriefResponseSchema
	} from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';
	import ArtistPicker from './ArtistPicker.svelte';
	import MarketPicker from './MarketPicker.svelte';
	import PromoterFields from './PromoterFields.svelte';
	import { buildPayload, emptyForm, issueField, validateDates } from './form';

	let { prefill }: { prefill: { market: string | null; artist: string | null } } = $props();

	const form = $state(emptyForm());
	// One-time prefill from ?market= and ?artist=.
	// svelte-ignore state_referenced_locally
	const market = findMarket(prefill.market);
	if (market) {
		form.marketId = market.id;
		form.city = market.name;
		form.country = market.country;
		form.localityEntityId = market.localityEntityId;
		form.localityName = market.localityName;
	}
	// svelte-ignore state_referenced_locally
	if (prefill.artist) form.artist = prefill.artist.slice(0, 200);

	let errors = $state<Record<string, string>>({});
	let submitting = $state(false);
	let banner = $state<{ message: string; details?: string[]; retry: boolean } | undefined>();

	function validate(): boolean {
		const next: Record<string, string> = {};
		const dates = validateDates(form.dateFrom, form.dateTo);
		if (dates.dateFrom) next.dateFrom = dates.dateFrom;
		if (dates.dateTo) next.dateTo = dates.dateTo;
		if (!form.localityName && !form.city.trim())
			next.market = 'Choose a market or search for a city.';
		const parsed = createBriefRequestSchema.safeParse(buildPayload(form));
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const key = issueField(issue.path);
				if (key === 'artist') next.artist ??= 'Enter an artist.';
				else if (key === 'city' || key === 'country')
					next.market ??= 'Choose a market or search for a city.';
				else if (key === 'promoter') {
					next.promoter ??= `Check your numbers: ${issue.path.slice(1).join(' ')} ${issue.message}`;
				} else next[key] ??= issue.message;
			}
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		banner = undefined;
		if (!validate()) return;
		submitting = true;
		try {
			const res = await fetch('/api/briefs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(createBriefRequestSchema.parse(buildPayload(form)))
			});
			if (res.status === 200 || res.status === 201) {
				const { id } = createBriefResponseSchema.parse(await res.json());
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- /brief/[id] route is owned by another module
				await goto(`/brief/${id}`);
				return;
			}
			if (res.status === 429) {
				banner = {
					message: 'The agent is busy with other briefs right now. Try again in a few minutes.',
					retry: true
				};
			} else if (res.status === 400) {
				const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
				banner = {
					message: body.success ? body.data.error : 'The request was not valid.',
					details: body.success ? body.data.details : undefined,
					retry: false
				};
			} else {
				banner = { message: 'Something went wrong on our side. Please try again.', retry: true };
			}
		} catch {
			banner = {
				message: 'Could not reach the server. Check your connection and try again.',
				retry: true
			};
		} finally {
			submitting = false;
		}
	}

	const dateInput =
		'w-full rounded-lg border-0 px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600';
</script>

<form onsubmit={submit} class="space-y-6" novalidate>
	<MarketPicker {form} error={errors.market} />
	<ArtistPicker {form} error={errors.artist} />

	<fieldset class="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
		<legend class="px-1 text-base font-semibold">3. Date window</legend>
		<div class="mt-2 grid gap-3 sm:grid-cols-2">
			<label class="block">
				<span class="text-sm font-medium">From</span>
				<input type="date" class="{dateInput} mt-1" bind:value={form.dateFrom} />
				{#if errors.dateFrom}<span class="text-sm text-rose-700" role="alert"
						>{errors.dateFrom}</span
					>{/if}
			</label>
			<label class="block">
				<span class="text-sm font-medium">To</span>
				<input type="date" class="{dateInput} mt-1" bind:value={form.dateTo} />
				{#if errors.dateTo}<span class="text-sm text-rose-700" role="alert">{errors.dateTo}</span
					>{/if}
			</label>
		</div>
	</fieldset>

	<PromoterFields {form} error={errors.promoter} />

	{#if banner}
		<div class="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200" role="alert">
			<p class="font-medium">{banner.message}</p>
			{#if banner.details?.length}
				<ul class="mt-2 list-disc pl-5">
					{#each banner.details as d (d)}<li>{d}</li>{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<button
			type="submit"
			disabled={submitting}
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
		>
			{#if submitting}
				<span
					class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
					aria-hidden="true"
				></span>
				Starting the agent…
			{:else if banner?.retry}
				Try again
			{:else}
				Generate brief
			{/if}
		</button>
		<p class="text-sm text-zinc-500">
			A brief takes about five minutes. You can watch the agent work.
		</p>
	</div>
</form>
