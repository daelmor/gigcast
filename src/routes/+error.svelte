<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? 'Not found' : 'Something went wrong'} · gigcast</title></svelte:head
>

<section class="mx-auto max-w-md py-16 text-center">
	<p class="text-indigo-600 text-sm font-semibold">{page.status}</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">
		{notFound ? 'We could not find that page' : 'Something went wrong'}
	</h1>
	<p class="text-zinc-600 mt-3">
		{#if notFound}
			The page does not exist, or the brief was removed.
		{:else}
			{page.error?.message ?? 'An unexpected error happened.'} Try again in a moment.
		{/if}
	</p>
	<a
		href={resolve('/')}
		class="bg-indigo-600 text-white hover:bg-indigo-700 mt-6 inline-block rounded-lg px-4 py-2 text-sm font-medium"
		>Back to home</a
	>
</section>
