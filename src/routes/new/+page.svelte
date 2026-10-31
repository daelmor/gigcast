<script lang="ts">
	import { page } from '$app/state';
	import NewBriefForm from '$lib/components/new/NewBriefForm.svelte';

	let { data } = $props();

	const authMessages: Record<string, string> = {
		denied: 'That Google account is not on the list of people who can create briefs here.',
		failed: 'Sign-in did not complete. Please try again.',
		unconfigured: 'Sign-in is not set up on this server yet.'
	};
	const authMessage = $derived(data.auth ? authMessages[data.auth] : undefined);
</script>

<svelte:head><title>New brief · gigcast</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<h1 class="type-heading-1 sm:type-display">New booking brief</h1>
	<p class="mt-space-2 mb-space-6 type-body-lg text-ink-muted">
		Pick a market, an artist and a date window. The agent does the rest.
	</p>
	{#if authMessage}
		<p
			class="mb-space-5 rounded-lg border border-caution bg-caution-soft p-space-4 type-small text-ink"
			role="status"
		>
			{authMessage}
		</p>
	{/if}
	{#key `${data.market}|${data.artist}`}
		<NewBriefForm
			prefill={{ market: data.market, artist: data.artist }}
			signedIn={Boolean(page.data.user)}
			authRequired={page.data.authMode === 'required'}
		/>
	{/key}
</div>
