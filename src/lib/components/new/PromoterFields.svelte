<script lang="ts">
	import { MAX_SALES, MAX_VENUES, type FormState } from './form';

	let { form, error }: { form: FormState; error?: string } = $props();

	const input =
		'w-full rounded-lg border-0 px-3 py-2 ring-1 ring-zinc-300 focus:ring-2 focus:ring-indigo-600';
	const small = 'text-xs font-medium text-zinc-600';
</script>

<details class="bg-white ring-zinc-200 rounded-xl p-5 ring-1" open={!!error}>
	<summary class="cursor-pointer text-base font-semibold">
		4. Your own numbers <span class="text-zinc-500 text-sm font-normal">(optional)</span>
	</summary>
	<p class="text-zinc-500 mt-2 text-sm">
		Anything you add is used as given and marked as your input in the brief.
	</p>

	<div class="mt-4 space-y-6">
		<div>
			<p class="text-sm font-medium">Venues you can book</p>
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
					class="text-indigo-600 hover:text-indigo-700 mt-2 text-sm font-medium"
					onclick={() => form.venues.push({ name: '', capacity: '' })}>Add venue</button
				>
			{/if}
		</div>

		<div>
			<p class="text-sm font-medium">Ticket price range</p>
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
			<p class="text-sm font-medium">Budget</p>
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
			<p class="text-sm font-medium">Past sales</p>
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
					class="text-indigo-600 hover:text-indigo-700 mt-2 text-sm font-medium"
					onclick={() => form.sales.push({ event: '', date: '', sold: '', capacity: '' })}
					>Add past event</button
				>
			{/if}
		</div>

		<label class="block">
			<span class="text-sm font-medium">Notes</span>
			<textarea
				class="{input} mt-2"
				rows="3"
				maxlength="2000"
				placeholder="Anything the agent should know: constraints, partners, past issues."
				bind:value={form.notes}
			></textarea>
			<span class="text-zinc-500 text-xs">{form.notes.length} / 2000</span>
		</label>
	</div>
	{#if error}<p class="text-rose-700 mt-3 text-sm" role="alert">{error}</p>{/if}
</details>
