<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Something went wrong'} · gigcast</title></svelte:head
>

<section class="mx-auto max-w-md py-space-8">
	<p class="type-label text-ink-subtle tabular-nums">{page.status}</p>
	<h1 class="mt-space-2 type-heading-1 text-ink">
		{notFound ? 'We could not find that page' : 'Something went wrong on our side'}
	</h1>
	<p class="mt-space-3 type-body text-ink-muted">
		{#if notFound}
			The page does not exist, or the brief was removed.
		{:else}
			{page.error?.message ?? 'An unexpected error happened.'} Try again in a moment.
		{/if}
	</p>
	<div class="mt-space-6 flex flex-wrap gap-space-3">
		<Button variant="secondary" href={resolve('/')}>Go home</Button>
		<Button variant="primary" href={resolve('/new')}>Start a brief</Button>
	</div>
</section>
