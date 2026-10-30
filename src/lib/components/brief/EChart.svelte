<script lang="ts">
	/**
	 * Generic ECharts wrapper. Loads only the pieces the brief uses, on the
	 * client, and shows `fallback` text until the chart is mounted.
	 */
	import { onMount } from 'svelte';
	import type { EChartsCoreOption, ECharts } from 'echarts/core';
	import { theme, watchTheme } from '$lib/client/theme-colors.svelte';

	interface Props {
		option: EChartsCoreOption;
		class?: string;
		/** Accessible description and pre-mount text. */
		fallback?: string;
	}

	let { option, class: className = '', fallback = 'Loading chart…' }: Props = $props();

	let el: HTMLDivElement;
	let chart: ECharts | undefined;
	let ready = $state(false);

	/** Fonts and text colours from the tokens, applied under the caller's option. */
	const themed = (o: EChartsCoreOption): EChartsCoreOption => ({
		textStyle: { fontFamily: theme.fonts.sans, color: theme.colors['ink-muted'] },
		...o
	});

	onMount(() => {
		watchTheme();
		let cancelled = false;
		let observer: ResizeObserver | undefined;
		(async () => {
			try {
				const [core, charts, components, renderers] = await Promise.all([
					import('echarts/core'),
					import('echarts/charts'),
					import('echarts/components'),
					import('echarts/renderers')
				]);
				if (cancelled) return;
				core.use([
					charts.BarChart,
					charts.LineChart,
					components.GridComponent,
					components.TooltipComponent,
					renderers.SVGRenderer
				]);
				chart = core.init(el, undefined, { renderer: 'svg' });
				chart.setOption(themed(option));
				ready = true;
				observer = new ResizeObserver(() => chart?.resize());
				observer.observe(el);
			} catch {
				// Keep the text fallback.
			}
		})();
		return () => {
			cancelled = true;
			observer?.disconnect();
			chart?.dispose();
			chart = undefined;
		};
	});

	$effect(() => {
		const o = option;
		void theme.version;
		if (chart) chart.setOption(themed(o), true);
	});
</script>

<div class="relative {className}" role="img" aria-label={fallback}>
	<div bind:this={el} class="h-full w-full"></div>
	{#if !ready}
		<p class="absolute inset-0 flex items-center justify-center type-small text-ink-subtle">
			{fallback}
		</p>
	{/if}
</div>
