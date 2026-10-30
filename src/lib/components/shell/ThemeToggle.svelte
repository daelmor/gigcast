<script lang="ts">
	/**
	 * Three-state theme switch: System (follow the OS), Light, Dark. The choice lives in
	 * localStorage under `gigcast-theme`; the inline script in app.html applies it before paint
	 * so the page never flashes. "System" removes the attribute and lets the media query decide.
	 */
	import { onMount } from 'svelte';

	type Preference = 'system' | 'light' | 'dark';
	const KEY = 'gigcast-theme';
	const options: { value: Preference; label: string }[] = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	let preference = $state<Preference>('system');

	onMount(() => {
		try {
			const stored = localStorage.getItem(KEY);
			if (stored === 'light' || stored === 'dark') preference = stored;
		} catch {
			// Storage blocked: keep System.
		}
	});

	function apply(next: Preference) {
		preference = next;
		const root = document.documentElement;
		if (next === 'system') root.removeAttribute('data-theme');
		else root.setAttribute('data-theme', next);
		try {
			if (next === 'system') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, next);
		} catch {
			// Storage blocked: the attribute still applies for this page view.
		}
	}
</script>

<div
	role="radiogroup"
	aria-label="Theme"
	class="inline-flex items-center rounded-md border border-line-strong bg-surface-raised p-0.5"
>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={preference === option.value}
			onclick={() => apply(option.value)}
			class="rounded-sm px-2 py-0.5 type-small font-medium text-ink-muted transition-colors duration-[120ms] hover:text-ink aria-checked:bg-signal-soft aria-checked:text-signal"
		>
			{option.label}
		</button>
	{/each}
</div>
