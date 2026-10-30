<script lang="ts">
	/** Five dots for a risk item's severity: filled dots are critical, empty ones line. */
	let { severity, class: className = '' }: { severity: number; class?: string } = $props();
	const filled = $derived(Math.max(0, Math.min(5, Math.round(severity))));
</script>

<span
	class="inline-flex items-center gap-[3px] {className}"
	role="img"
	aria-label="Severity {filled} of 5"
	title="Severity {filled} of 5"
>
	{#each [1, 2, 3, 4, 5] as n (n)}
		<span class="size-2 rounded-full {n <= filled ? 'bg-critical' : 'bg-line'}"></span>
	{/each}
</span>
