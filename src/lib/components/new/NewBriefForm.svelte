<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		apiErrorSchema,
		createBriefRequestSchema,
		createBriefResponseSchema
	} from '$lib/api/contracts';
	import { findMarket } from '$lib/markets';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
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
				await goto(resolve('/brief/[id]', { id }));
				return;
			}
			if (res.status === 429) {
				const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
				banner = {
					message: body.success
						? body.data.error
						: 'The agent is at capacity right now. Try again in a few minutes.',
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
		'mt-1 w-full rounded-sm border border-line-strong bg-surface-raised px-3 py-2 type-body text-ink';
</script>

<form onsubmit={submit} class="space-y-space-5" novalidate>
	<MarketPicker
		{form}
		error={errors.market}
		onpicked={() => document.getElementById('artist-input')?.focus()}
	/>
	<ArtistPicker {form} error={errors.artist} />

	<Card>
		<fieldset class="m-0 min-w-0 border-0 p-0">
			<legend class="px-0 type-heading-3">3. Date window</legend>
			<div class="mt-space-3 grid gap-space-3 sm:grid-cols-2">
				<label class="block">
					<span class="type-label text-ink-subtle">From</span>
					<input type="date" class={dateInput} bind:value={form.dateFrom} />
					{#if errors.dateFrom}<span class="block type-small text-critical" role="alert"
							>{errors.dateFrom}</span
						>{/if}
				</label>
				<label class="block">
					<span class="type-label text-ink-subtle">To</span>
					<input type="date" class={dateInput} bind:value={form.dateTo} />
					{#if errors.dateTo}<span class="block type-small text-critical" role="alert"
							>{errors.dateTo}</span
						>{/if}
				</label>
			</div>
		</fieldset>
	</Card>

	<PromoterFields {form} error={errors.promoter} />

	{#if banner}
		<div
			class="rounded-lg border border-critical bg-critical-soft p-space-4 type-small text-critical"
			role="alert"
		>
			<p class="font-semibold">{banner.message}</p>
			{#if banner.details?.length}
				<ul class="mt-space-2 list-disc pl-5">
					{#each banner.details as d, i (i)}<li>{d}</li>{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-space-3 sm:flex-row sm:items-center">
		<Button variant="primary" type="submit" disabled={submitting}>
			{#if submitting}
				Starting…
			{:else if banner?.retry}
				Try again
			{:else}
				Generate brief
			{/if}
		</Button>
		<p class="type-small text-ink-muted">
			A brief takes about five minutes. You can watch the agent work.
		</p>
	</div>
</form>
