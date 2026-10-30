<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Something went wrong'} · gigcast</title></svelte:head
>

<section class="mx-auto max-w-md py-16 text-center">
	<p class="text-sm font-semibold text-indigo-600">{page.status}</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">
		{notFound ? 'We could not find that page' : 'Something went wrong'}
	</h1>
	<p class="mt-3 text-zinc-600">
		{#if notFound}
			The page does not exist, or the brief was removed.
		{:else}
			{page.error?.message ?? 'An unexpected error happened.'} Try again in a moment.
		{/if}
	</p>
	<a
		href={resolve('/')}
		class="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>Back to home</a
	>
</section>
