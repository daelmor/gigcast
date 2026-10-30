<script lang="ts">
	/**
	 * The label every claim carries: Grounded, Inferred or No coverage. Word plus a shape-coded
	 * glyph (filled, half, hollow dot) so it survives colour blindness and grayscale print.
	 * `bare` drops the pill for the table of contents and dense tables.
	 */
	import { LABEL_HELP, type Label } from '$lib/brief/schema';

	interface Props {
		label: Label;
		bare?: boolean;
		/** Pill height: md is the default 24px; sm fits inside dense table cells. */
		size?: 'md' | 'sm';
		class?: string;
	}
	let { label, bare = false, size = 'md', class: className = '' }: Props = $props();

	const WORD: Record<Label, string> = {
		grounded: 'Grounded',
		inferred: 'Inferred',
		no_coverage: 'No coverage'
	};
	const TONE: Record<Label, string> = {
		grounded: 'text-grounded',
		inferred: 'text-inferred',
		no_coverage: 'text-no-coverage'
	};
	const PILL: Record<Label, string> = {
		grounded: 'bg-grounded-soft',
		inferred: 'bg-inferred-soft',
		no_coverage: 'bg-no-coverage-soft'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap {TONE[label]} {bare
		? ''
		: `${PILL[label]} rounded-pill ${size === 'sm' ? 'h-5 pr-2 pl-1.5 text-[11px] leading-4' : 'h-6 pr-2.5 pl-2 text-[12px] leading-4'}`} {bare
		? 'text-[12px] leading-4'
		: ''} {className}"
	title={LABEL_HELP[label]}
	data-label={label}
>
	<span class="glyph glyph-{label}" aria-hidden="true"></span>
	{WORD[label]}
</span>

<style>
	.glyph {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		box-sizing: border-box;
		border: 2px solid currentColor;
		flex: none;
	}
	.glyph-grounded {
		background: currentColor;
	}
	.glyph-inferred {
		background: linear-gradient(90deg, currentColor 50%, transparent 50%);
	}
	.glyph-no_coverage {
		background: transparent;
	}
</style>
