<script lang="ts">
	import { LABEL_HELP, type Label } from '$lib/brief/schema';

	interface Props {
		label: Label;
		/** `sm` for inline use next to a title, `md` for section headers. */
		size?: 'sm' | 'md';
		class?: string;
	}

	let { label, size = 'sm', class: className = '' }: Props = $props();

	const styles: Record<Label, string> = {
		grounded: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
		inferred: 'bg-amber-50 text-amber-900 ring-amber-600/25',
		no_coverage: 'bg-zinc-100 text-zinc-600 ring-zinc-500/25'
	};
	const dots: Record<Label, string> = {
		grounded: 'bg-emerald-500',
		inferred: 'bg-amber-500',
		no_coverage: 'bg-zinc-400'
	};
	const text: Record<Label, string> = {
		grounded: 'Grounded',
		inferred: 'Inferred',
		no_coverage: 'No coverage'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset {styles[
		label
	]} {size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'} {className}"
	title={LABEL_HELP[label]}
	data-label={label}
>
	<span class="size-1.5 rounded-full {dots[label]}" aria-hidden="true"></span>
	{text[label]}
</span>
