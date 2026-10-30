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
		class="text-sm font-medium text-indigo-600 hover:text-indigo-800 print:hidden"
	>
		← Back to the brief
	</a>
	<h1 class="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Sponsor outreach drafts</h1>
	<p class="mt-1 text-sm text-zinc-600">{brief.draft.headline}</p>

	<div class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
		These are drafts written by the model from Qloo affinity signals. Review and edit them before
		use. gigcast never sends anything: the email link only opens your own email app.
	</div>

	{#if picks.length === 0}
		<p class="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
			No sponsor suggestions in this brief, so there are no drafts.
		</p>
	{:else}
		<ul class="mt-6 space-y-6">
			{#each picks as pick (pick.entityId)}
				{@const text = `Subject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}`}
				<li class="rounded-xl bg-white p-5 ring-1 ring-zinc-200 print:break-inside-avoid">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="text-lg font-semibold text-zinc-900">{pick.name}</h2>
							{#if pick.category}<p class="text-xs text-zinc-500">{pick.category}</p>{/if}
						</div>
						<div class="flex items-center gap-3">
							<Label label={pick.label} />
							{#if pick.affinity !== undefined}
								<div class="text-right">
									<p class="text-2xl font-semibold text-zinc-900 tabular-nums">
										{pct(pick.affinity)}
									</p>
									<p class="text-xs text-zinc-500">affinity</p>
								</div>
							{/if}
						</div>
					</div>
					<p class="mt-3 text-sm leading-relaxed text-zinc-700">{pick.why}</p>

					<p class="mt-4 text-xs font-medium text-zinc-500 uppercase">Subject</p>
					<p class="text-sm font-medium text-zinc-900">{pick.outreachDraft.subject}</p>
					<p class="mt-3 text-xs font-medium text-zinc-500 uppercase">Body</p>
					<div
						class="mt-1 rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 ring-1 ring-zinc-200"
					>
						{pick.outreachDraft.body}
					</div>

					<div class="mt-3 flex flex-wrap gap-2 print:hidden">
						<button
							type="button"
							onclick={() => copy(pick.entityId, text)}
							class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-zinc-300 hover:bg-zinc-50"
						>
							{copied === pick.entityId ? 'Copied' : 'Copy'}
						</button>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- mailto: is not an app route -->
						<a
							href={mailto(pick.outreachDraft.subject, pick.outreachDraft.body)}
							class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
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
