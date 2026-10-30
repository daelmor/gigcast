<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import { MAX_SALES, MAX_VENUES, type FormState } from './form';

	let { form, error }: { form: FormState; error?: string } = $props();

	const input =
		'w-full rounded-sm border border-line-strong bg-surface-raised px-3 py-2 type-body text-ink placeholder:text-ink-subtle';
	const small = 'type-label block text-ink-subtle';
</script>

<Card>
	<details open={!!error}>
		<summary class="cursor-pointer type-heading-3">
			4. Your own numbers <span class="type-small font-normal text-ink-muted">(optional)</span>
		</summary>
		<p class="mt-space-2 type-small text-ink-muted">
			Anything you add is used as given and marked as your input in the brief.
		</p>

		<div class="mt-space-4 space-y-space-5">
			<div>
				<p class="type-label text-ink-subtle">Venues you can book</p>
				{#each form.venues as v, i (i)}
					<div class="mt-2 grid grid-cols-[1fr_7rem] gap-2">
						<input
							class={input}
							placeholder="Venue name"
							aria-label="Venue {i + 1} name"
							bind:value={v.name}
						/>
						<input
							class={input}
							type="number"
							min="1"
							inputmode="numeric"
							placeholder="Capacity"
							aria-label="Venue {i + 1} capacity"
							bind:value={v.capacity}
						/>
					</div>
				{/each}
				{#if form.venues.length < MAX_VENUES}
					<button
						type="button"
						class="mt-2 type-small font-semibold text-signal hover:underline"
						onclick={() => form.venues.push({ name: '', capacity: '' })}>Add venue</button
					>
				{/if}
			</div>

			<div>
				<p class="type-label text-ink-subtle">Ticket price range</p>
				<div class="mt-2 grid grid-cols-3 gap-2">
					<label class="block"
						><span class={small}>Min</span><input
							class={input}
							type="number"
							min="0"
							step="any"
							bind:value={form.priceMin}
						/></label
					>
					<label class="block"
						><span class={small}>Max</span><input
							class={input}
							type="number"
							min="0"
							step="any"
							bind:value={form.priceMax}
						/></label
					>
					<label class="block"
						><span class={small}>Currency</span><input
							class="{input} uppercase"
							maxlength="3"
							bind:value={form.priceCurrency}
						/></label
					>
				</div>
			</div>

			<div>
				<p class="type-label text-ink-subtle">Budget</p>
				<div class="mt-2 grid grid-cols-[1fr_6rem] gap-2">
					<label class="block"
						><span class={small}>Amount</span><input
							class={input}
							type="number"
							min="0"
							step="any"
							bind:value={form.budgetAmount}
						/></label
					>
					<label class="block"
						><span class={small}>Currency</span><input
							class="{input} uppercase"
							maxlength="3"
							bind:value={form.budgetCurrency}
						/></label
					>
				</div>
			</div>

			<div>
				<p class="type-label text-ink-subtle">Past sales</p>
				{#each form.sales as s, i (i)}
					<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
						<input
							class="{input} col-span-2 sm:col-span-1"
							placeholder="Event"
							aria-label="Past event {i + 1} name"
							bind:value={s.event}
						/>
						<input
							class={input}
							type="date"
							aria-label="Past event {i + 1} date"
							bind:value={s.date}
						/>
						<input
							class={input}
							type="number"
							min="0"
							placeholder="Sold"
							aria-label="Past event {i + 1} tickets sold"
							bind:value={s.sold}
						/>
						<input
							class={input}
							type="number"
							min="1"
							placeholder="Capacity"
							aria-label="Past event {i + 1} capacity"
							bind:value={s.capacity}
						/>
					</div>
				{/each}
				{#if form.sales.length < MAX_SALES}
					<button
						type="button"
						class="mt-2 type-small font-semibold text-signal hover:underline"
						onclick={() => form.sales.push({ event: '', date: '', sold: '', capacity: '' })}
						>Add past event</button
					>
				{/if}
			</div>

			<label class="block">
				<span class="type-label text-ink-subtle">Notes</span>
				<textarea
					class="{input} mt-2"
					rows="3"
					maxlength="2000"
					placeholder="Anything the agent should know: constraints, partners, past issues."
					bind:value={form.notes}
				></textarea>
				<span class="type-small text-ink-subtle">{form.notes.length} / 2000</span>
			</label>
		</div>
		{#if error}<p class="mt-space-3 type-small text-critical" role="alert">{error}</p>{/if}
	</details>
</Card>
