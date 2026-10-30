<script lang="ts">
	let { severity }: { severity: number } = $props();
</script>

<span
	class="inline-flex items-center gap-0.5"
	role="img"
	aria-label="Severity {severity} of 5"
	title="Severity {severity} of 5"
>
	{#each [1, 2, 3, 4, 5] as n (n)}
		<span class="size-2.5 rounded-full {n <= severity ? 'bg-rose-500' : 'bg-zinc-200'}"></span>
	{/each}
</span>
