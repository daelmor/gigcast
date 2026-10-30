<script lang="ts">
	type Box = { x: number; y: number; w: number; h: number; title: string; lines?: string[] };

	const boxes: Box[] = [
		{ x: 20, y: 40, w: 170, h: 90, title: 'Browser', lines: ['SvelteKit', 'MapLibre, ECharts'] },
		{
			x: 250,
			y: 40,
			w: 200,
			h: 90,
			title: 'SvelteKit server',
			lines: ['Azure Container Apps', 'SSE stream, run manager']
		},
		{
			x: 510,
			y: 40,
			w: 230,
			h: 130,
			title: 'Claude on Vertex AI',
			lines: [
				'Tool runner: 12 Qloo tools,',
				'market_calendar, risk_feed,',
				'emit_brief',
				'Counterfactual run: no tools'
			]
		},
		{ x: 790, y: 40, w: 150, h: 90, title: 'Qloo API', lines: ['Taste AI graph'] },
		{
			x: 250,
			y: 250,
			w: 260,
			h: 120,
			title: 'Postgres on Neon',
			lines: [
				'briefs, runs, events, Qloo cache,',
				'news and classifications,',
				'holiday and weather caches'
			]
		},
		{
			x: 20,
			y: 250,
			w: 170,
			h: 80,
			title: 'Scheduled job',
			lines: ['POST /api/jobs/ingest']
		},
		{
			x: 560,
			y: 330,
			w: 380,
			h: 150,
			title: 'External sources',
			lines: [
				'Google News RSS, local outlets',
				'Nager.Date (holidays)',
				'Open-Meteo (weather)',
				'US State Department, UK FCDO'
			]
		}
	];

	// [x1, y1, x2, y2, label, label x, label y]
	const arrows: [number, number, number, number, string, number, number][] = [
		[190, 85, 250, 85, 'HTTP, SSE', 192, 74],
		[450, 70, 510, 70, 'run', 464, 60],
		[740, 85, 790, 85, 'tools', 746, 74],
		[350, 130, 350, 250, 'read, write', 358, 195],
		[105, 250, 250, 130, 'ingest', 140, 200],
		[560, 400, 510, 350, 'ingest', 520, 395]
	];
</script>

<svg
	viewBox="0 0 960 520"
	class="h-auto w-full"
	role="img"
	aria-labelledby="arch-title arch-desc"
	font-family="inherit"
>
	<title id="arch-title">gigcast architecture</title>
	<desc id="arch-desc"
		>The browser talks to a SvelteKit server on Azure Container Apps, which runs Claude on Vertex AI
		with tools backed by the Qloo API. The server stores briefs and caches in Postgres on Neon. A
		scheduled job triggers ingestion of external news, holiday, weather and advisory sources.</desc
	>
	<defs>
		<marker
			id="arrow"
			viewBox="0 0 10 10"
			refX="9"
			refY="5"
			markerWidth="7"
			markerHeight="7"
			orient="auto-start-reverse"
		>
			<path d="M0 0 L10 5 L0 10 z" class="fill-line-strong" />
		</marker>
	</defs>

	{#each arrows as [x1, y1, x2, y2, label, lx, ly] (label + x1 + y1)}
		<line
			{x1}
			{y1}
			{x2}
			{y2}
			class="stroke-line-strong"
			stroke-width="1.5"
			marker-end="url(#arrow)"
		/>
		<text x={lx} y={ly} font-size="12" class="fill-ink-muted">{label}</text>
	{/each}

	{#each boxes as b (b.title)}
		<rect
			x={b.x}
			y={b.y}
			width={b.w}
			height={b.h}
			rx="10"
			class="fill-surface-raised {b.title === 'Claude on Vertex AI' || b.title === 'Qloo API'
				? 'stroke-signal'
				: 'stroke-line-strong'}"
			stroke-width="1.5"
		/>
		<text x={b.x + 12} y={b.y + 24} font-size="14" font-weight="600" class="fill-ink"
			>{b.title}</text
		>
		{#each b.lines ?? [] as line, i (line)}
			<text x={b.x + 12} y={b.y + 46 + i * 18} font-size="12" class="fill-ink-muted">{line}</text>
		{/each}
	{/each}
</svg>
