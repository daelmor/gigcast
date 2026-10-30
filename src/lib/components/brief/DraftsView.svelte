<script lang="ts">
	import { resolve } from '$app/paths';
	import Label from '../ui/Label.svelte';
	import { pct } from './format';
	import type { Brief } from '$lib/brief/schema';

	let { brief }: { brief: Brief } = $props();

	const picks = $derived(brief.draft.sponsors.picks);
	let copied = $state<string>();

	const mailto = (subject: string, body: string) =>
		`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

	async function copy(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			setTimeout(() => {
				if (copied === id) copied = undefined;
			}, 2000);
		} catch {
			// Clipboard unavailable: the text stays selectable on the page.
		}
	}
</script>

<div class="mx-auto max-w-3xl">
	<a
		href={resolve('/brief/[id]', { id: brief.id })}
		class="text-indigo-600 hover:text-indigo-800 text-sm font-medium print:hidden"
	>
		← Back to the brief
	</a>
	<h1 class="text-zinc-900 mt-2 text-2xl font-semibold tracking-tight">Sponsor outreach drafts</h1>
	<p class="text-zinc-600 mt-1 text-sm">{brief.draft.headline}</p>

	<div class="bg-amber-50 text-amber-900 ring-amber-200 mt-5 rounded-xl p-4 text-sm ring-1">
		These are drafts written by the model from Qloo affinity signals. Review and edit them before
		use. gigcast never sends anything: the email link only opens your own email app.
	</div>

	{#if picks.length === 0}
		<p class="bg-zinc-50 text-zinc-600 ring-zinc-200 mt-6 rounded-xl p-4 text-sm ring-1">
			No sponsor suggestions in this brief, so there are no drafts.
		</p>
	{:else}
		<ul class="mt-6 space-y-6">
			{#each picks as pick (pick.entityId)}
				{@const text = `Subject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}`}
				<li class="bg-white ring-zinc-200 rounded-xl p-5 ring-1 print:break-inside-avoid">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="text-zinc-900 text-lg font-semibold">{pick.name}</h2>
							{#if pick.category}<p class="text-zinc-500 text-xs">{pick.category}</p>{/if}
						</div>
						<div class="flex items-center gap-3">
							<Label label={pick.label} />
							{#if pick.affinity !== undefined}
								<div class="text-right">
									<p class="text-zinc-900 text-2xl font-semibold tabular-nums">
										{pct(pick.affinity)}
									</p>
									<p class="text-zinc-500 text-xs">affinity</p>
								</div>
							{/if}
						</div>
					</div>
					<p class="text-zinc-700 mt-3 text-sm leading-relaxed">{pick.why}</p>

					<p class="text-zinc-500 mt-4 text-xs font-medium uppercase">Subject</p>
					<p class="text-zinc-900 text-sm font-medium">{pick.outreachDraft.subject}</p>
					<p class="text-zinc-500 mt-3 text-xs font-medium uppercase">Body</p>
					<div
						class="bg-zinc-50 text-zinc-800 ring-zinc-200 mt-1 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap ring-1"
					>
						{pick.outreachDraft.body}
					</div>

					<div class="mt-3 flex flex-wrap gap-2 print:hidden">
						<button
							type="button"
							onclick={() => copy(pick.entityId, text)}
							class="bg-white text-indigo-600 ring-zinc-300 hover:bg-zinc-50 rounded-lg px-3 py-1.5 text-sm font-medium ring-1"
						>
							{copied === pick.entityId ? 'Copied' : 'Copy'}
						</button>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- mailto: is not an app route -->
						<a
							href={mailto(pick.outreachDraft.subject, pick.outreachDraft.body)}
							class="bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg px-3 py-1.5 text-sm font-medium"
						>
							Open in your email app
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
