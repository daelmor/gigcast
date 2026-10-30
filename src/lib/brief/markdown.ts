/**
 * Booking Brief -> Markdown. Pure and deterministic: no I/O, no clock, no
 * Node-only imports, so it can run in the browser.
 */
import {
	BRIEF_SECTIONS,
	LABEL_HELP,
	type ArtistPick,
	type Brief,
	type BriefSection,
	type Label,
	type PlacePick,
	type RiskItem,
	type SectionNote,
	type SourceRef,
	type SponsorPick
} from './schema';

export interface RenderBriefOptions {
	/** Accepted for API stability; the trace is not part of `Brief`. */
	includeTrace?: boolean;
	/** Default true. When false, no Sources section and no [S#] markers. */
	includeSources?: boolean;
}

const SECTION_TITLES: Record<BriefSection, string> = {
	audience: 'Audience map',
	demandAndFit: 'Demand and fit',
	lineup: 'Lineup',
	sponsors: 'Sponsors',
	venuesAndPartners: 'Venues and partners',
	pricing: 'Pricing guidance',
	risks: 'Risk panel'
};

const LABEL_BADGE: Record<Label, string> = {
	grounded: '**Grounded**',
	inferred: '**Inferred**',
	no_coverage: '**No coverage**'
};

const RISK_UNAVAILABLE =
	'The risk layer is not available in this build; nothing here is a safety judgment.';

function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function num(value: number | null | undefined, digits = 2): string | undefined {
	return isPresent(value) && Number.isFinite(value) ? value.toFixed(digits) : undefined;
}

function pct(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function words(value: string): string {
	return value.replace(/_/g, ' ');
}

function cell(value: string | undefined): string {
	return (value ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

function table(headers: string[], rows: string[][]): string[] {
	return [
		`| ${headers.join(' | ')} |`,
		`| ${headers.map(() => '---').join(' | ')} |`,
		...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)
	];
}

function fence(text: string): string[] {
	let ticks = '```';
	while (text.includes(ticks)) ticks += '`';
	return [`${ticks}text`, text, ticks];
}

function parenthesize(parts: Array<string | undefined>): string {
	const filled = parts.filter((p): p is string => !!p);
	return filled.length > 0 ? ` (${filled.join(', ')})` : '';
}

function suffix(text: string | undefined): string {
	return text ? `: ${text}` : '';
}

/** Every distinct SourceRef in the artifacts, in artifact order. */
function collectSourceRefs(brief: Brief): SourceRef[] {
	const a = brief.artifacts;
	const candidates: Array<SourceRef | undefined> = [
		a.heatmap?.source,
		a.neighbourhoods?.source,
		a.demographics?.source,
		a.trending?.source,
		a.artistTags?.source,
		a.cityTags?.source,
		a.cityArtists?.source,
		a.lineupCandidates?.source,
		a.sponsorCandidates?.source,
		...(a.placeCandidates ?? []).map((p) => p.source),
		// Every other tool call that made a Qloo request, so any cited id resolves to a source.
		...(a.calls ?? [])
	];
	const seen = new Map<string, SourceRef>();
	for (const ref of candidates) {
		if (ref && !seen.has(ref.toolCallId)) seen.set(ref.toolCallId, ref);
	}
	return [...seen.values()];
}

export function renderBriefMarkdown(brief: Brief, options: RenderBriefOptions = {}): string {
	const includeSources = options.includeSources !== false;
	const { draft, input, resolution, run } = brief;

	// Source numbering by first appearance in the document.
	const refsById = new Map(collectSourceRefs(brief).map((r) => [r.toolCallId, r]));
	const numbering = new Map<string, number>();
	const number = (id: string): number => {
		let n = numbering.get(id);
		if (n === undefined) {
			n = numbering.size + 1;
			numbering.set(id, n);
		}
		return n;
	};
	const cite = (ids: readonly string[] | undefined): string => {
		if (!includeSources || !ids) return '';
		const known = [...new Set(ids)].filter((id) => refsById.has(id));
		return known.map((id) => `[S${number(id)}]`).join('');
	};
	const citeRef = (ref: SourceRef | undefined): string => (ref ? cite([ref.toolCallId]) : '');
	const badge = (label: Label, ids?: readonly string[]): string => `[${label}]${cite(ids)}`;

	const out: string[] = [];
	const blank = () => out.push('');
	const heading = (level: number, text: string) => {
		blank();
		out.push(`${'#'.repeat(level)} ${text}`);
		blank();
	};
	const note = (n: SectionNote) => {
		out.push(`${LABEL_BADGE[n.label]}: ${n.summary}`);
		if (n.caveats.length > 0) {
			blank();
			for (const c of n.caveats) out.push(`- _${c}_`);
		}
		blank();
	};

	// Title
	out.push(`# Booking Brief: ${resolution.artist.name || input.artist} in ${input.city}`);
	blank();
	out.push(
		`${input.dateFrom} to ${input.dateTo} | Verdict: **${words(draft.verdict)}** | ${draft.headline}`
	);

	heading(2, 'Key points');
	for (const point of draft.keyPoints) out.push(`- ${point}`);

	const a = brief.artifacts;
	const renderers = {} as Record<BriefSection, () => void>;

	renderers.audience = () => {
		heading(2, SECTION_TITLES.audience);
		note(draft.audience.note);
		if (draft.audience.hotspots.length > 0) {
			out.push('Hotspots:');
			blank();
			for (const h of draft.audience.hotspots) {
				const where = parenthesize([
					`${h.lat}, ${h.lon}`,
					h.geohash ? `geohash ${h.geohash}` : undefined
				]);
				out.push(`- **${h.name}**${where} ${badge(h.label, h.sources)}${suffix(h.why)}`);
			}
			blank();
		}
		if (a.heatmap) {
			const cells = a.heatmap.cells;
			out.push(
				`Heatmap: ${cells.length} cells; price-level dimensions ${a.heatmap.hasDimensions ? 'were' : 'were not'} available.${citeRef(a.heatmap.source)}`
			);
			const top = [...cells].sort((x, y) => y.affinity - x.affinity).slice(0, 5);
			if (top.length > 0) {
				blank();
				out.push('Top cells by affinity:');
				blank();
				const withPrice = top.some((c) => isPresent(c.priceLevel));
				const headers = [
					'Geohash',
					'Lat',
					'Lon',
					'Affinity',
					...(withPrice ? ['Price level affinity'] : [])
				];
				const rows = top.map((c) => [
					c.geohash,
					String(c.lat),
					String(c.lon),
					num(c.affinity) ?? '',
					...(withPrice ? [num(c.priceLevel) ?? ''] : [])
				]);
				out.push(...table(headers, rows));
			}
			blank();
		}
	};

	renderers.demandAndFit = () => {
		const d = draft.demandAndFit;
		heading(2, SECTION_TITLES.demandAndFit);
		note(d.note);
		const demandLines: string[] = [];
		if (isPresent(d.popularity)) demandLines.push(`- Popularity: ${num(d.popularity)}`);
		if (d.trend) {
			let line = `- Trend: **${d.trend.direction}** ${badge(d.trend.label, a.trending ? [a.trending.source.toolCallId] : [])}${suffix(d.trend.detail)}`;
			const last = a.trending?.items.at(-1);
			if (last) {
				const bits = [
					`date ${last.date}`,
					isPresent(last.percentile) ? `percentile ${num(last.percentile)}` : undefined,
					isPresent(last.rank) ? `rank ${last.rank}` : undefined,
					isPresent(last.velocity) ? `velocity ${num(last.velocity)}` : undefined
				].filter(Boolean);
				line += ` Latest point: ${bits.join(', ')}.`;
			}
			demandLines.push(line);
		}
		if (d.tasteMatch) {
			const t = d.tasteMatch;
			const tags = t.sharedTags.length > 0 ? ` Shared tags: ${t.sharedTags.join(', ')}.` : '';
			demandLines.push(
				`- Taste match${parenthesize([isPresent(t.score) ? `score ${num(t.score)}` : undefined])} ${badge(
					t.label,
					[a.artistTags?.source.toolCallId, a.cityTags?.source.toolCallId].filter(isPresent)
				)}${suffix(t.detail)}${tags}`
			);
		}
		if (demandLines.length > 0) {
			out.push(...demandLines);
			blank();
		}
		if (a.demographics || d.demographics) {
			const demo = d.demographics;
			const ids = a.demographics ? [a.demographics.source.toolCallId] : [];
			out.push(
				`Audience demographics${demo ? ` ${badge(demo.label, ids)}` : citeRef(a.demographics?.source)}:`
			);
			blank();
			if (a.demographics) {
				out.push(
					...table(
						['Age bucket', 'Affinity'],
						Object.entries(a.demographics.age).map(([k, v]) => [k, num(v) ?? ''])
					)
				);
				blank();
			}
			const genderValues = a.demographics
				? Object.entries(a.demographics.gender)
						.map(([k, v]) => `${k} ${num(v)}`)
						.join(', ')
				: '';
			const skew = demo ? demo.genderSkew : 'unknown';
			out.push(`Gender skew: ${skew}${genderValues ? ` (${genderValues})` : ''}.`);
			if (demo && demo.topAgeBuckets.length > 0)
				out.push(`Top age buckets: ${demo.topAgeBuckets.join(', ')}.`);
			blank();
		}
	};

	renderers.lineup = () => {
		heading(2, SECTION_TITLES.lineup);
		note(draft.lineup.note);
		const pickLine = (p: ArtistPick) =>
			`- **${p.name}**${parenthesize([words(p.role), isPresent(p.affinity) ? `affinity ${num(p.affinity)}` : undefined])} ${badge(p.label, p.sources)}${suffix(p.why)}`;
		for (const p of draft.lineup.picks) out.push(pickLine(p));
		if (draft.lineup.picks.length > 0) blank();
	};

	renderers.sponsors = () => {
		heading(2, SECTION_TITLES.sponsors);
		note(draft.sponsors.note);
		const sponsorHeading = (s: SponsorPick) =>
			`${s.name}${parenthesize([s.category, isPresent(s.affinity) ? `affinity ${num(s.affinity)}` : undefined])} ${badge(s.label, s.sources)}`;
		for (const s of draft.sponsors.picks) {
			out.push(`### ${sponsorHeading(s)}`);
			blank();
			out.push(s.why);
			blank();
			out.push('Outreach draft (a draft only; it was never sent):');
			blank();
			out.push(...fence(`Subject: ${s.outreachDraft.subject}\n\n${s.outreachDraft.body}`));
			blank();
		}
	};

	renderers.venuesAndPartners = () => {
		heading(2, SECTION_TITLES.venuesAndPartners);
		note(draft.venuesAndPartners.note);
		const placeLine = (p: PlacePick) =>
			`- **${p.name}**${parenthesize([
				words(p.kind),
				p.address,
				isPresent(p.priceLevel) ? `price level ${p.priceLevel}/4` : undefined,
				isPresent(p.rating) ? `rating ${num(p.rating, 1)}` : undefined
			])} ${badge(p.label, p.sources)}${suffix(p.why)}`;
		for (const p of draft.venuesAndPartners.picks) out.push(placeLine(p));
		if (draft.venuesAndPartners.picks.length > 0) blank();
	};

	renderers.pricing = () => {
		const pr = draft.pricing;
		heading(2, SECTION_TITLES.pricing);
		note(pr.note);
		if (pr.tiers.length > 0) {
			out.push(
				...table(
					['Tier', 'Price', 'Share', 'Rationale'],
					pr.tiers.map((t) => [t.name, `${t.price} ${pr.currency}`, pct(t.share), t.rationale])
				)
			);
			blank();
		}
		if (pr.assumptions.length > 0) {
			out.push('Assumptions:');
			blank();
			for (const s of pr.assumptions) out.push(`- ${s}`);
			blank();
		}
	};

	renderers.risks = () => {
		heading(2, SECTION_TITLES.risks);
		const risks = draft.risks;
		if (!risks || risks.note.label === 'no_coverage') {
			if (risks) note(risks.note);
			out.push(RISK_UNAVAILABLE);
			blank();
		} else {
			note(risks.note);
		}
		if (risks && risks.note.label !== 'no_coverage') {
			const riskLine = (r: RiskItem) =>
				`- **[severity ${r.severity}/5] ${words(r.category)}**: ${r.title}. So what: ${r.soWhat} Source: [${r.sourceName}](${r.sourceUrl})${r.publishedAt ? `, ${r.publishedAt}` : ''} [${r.label}]`;
			for (const r of risks.items) out.push(riskLine(r));
			if (risks.items.length > 0) blank();
		}
	};

	for (const section of BRIEF_SECTIONS) renderers[section]();

	// Open questions
	heading(2, 'Open questions');
	if (draft.openQuestions.length > 0) {
		for (const q of draft.openQuestions) out.push(`- ${q}`);
	} else {
		out.push('None.');
	}

	// Method and sources
	heading(2, 'Method and sources');
	out.push('Labels:');
	blank();
	for (const label of Object.keys(LABEL_HELP) as Label[]) {
		out.push(`- ${LABEL_BADGE[label]}: ${LABEL_HELP[label]}`);
	}
	blank();
	out.push('Resolution:');
	blank();
	const art = resolution.artist;
	out.push(
		`- Artist: ${art.name} (id \`${art.entityId}\`${isPresent(art.popularity) ? `, popularity ${num(art.popularity)}` : ''})${suffix(art.disambiguation)}`
	);
	const loc = resolution.locality;
	const locMethod: Record<typeof loc.method, string> = {
		entity_id: 'resolved to a locality entity id',
		point: 'resolved to a point',
		unresolved: 'unresolved'
	};
	out.push(
		`- Locality: ${loc.name ?? input.city}${loc.entityId ? ` (id \`${loc.entityId}\`)` : ''}, ${locMethod[loc.method]}${suffix(loc.disambiguation)}`
	);
	if (isPresent(loc.lat) && isPresent(loc.lon)) out.push(`- Coordinates: ${loc.lat}, ${loc.lon}`);
	for (const c of loc.candidates) {
		out.push(
			`- Candidate: ${c.name}${c.disambiguation ? ` (${c.disambiguation})` : ''}, ${c.acceptable ? 'acceptable' : 'rejected'}`
		);
	}
	blank();
	out.push('Run summary:');
	blank();
	out.push(`- Model: ${run.model}`);
	out.push(`- Status: ${run.status}`);
	out.push(`- Tool calls: ${run.toolCalls}`);
	out.push(`- Qloo calls: ${run.qlooCalls} (${run.qlooCacheHits} cache hits)`);
	out.push(
		`- Tokens: ${run.usage.inputTokens} input, ${run.usage.outputTokens} output, ${run.usage.cacheReadInputTokens} cache read, ${run.usage.cacheCreationInputTokens} cache creation`
	);
	if (run.stopReason) out.push(`- Stop reason: ${run.stopReason}`);
	if (run.error) out.push(`- Error: ${run.error}`);
	if (run.missingSections.length > 0) {
		const titled = run.missingSections.map((s) => SECTION_TITLES[s as BriefSection] ?? s);
		out.push(`- Missing sections: ${titled.join(', ')}`);
	}
	out.push(`- Generated: ${brief.createdAt}`);
	blank();
	out.push(
		`Verification: ${brief.verification.checked} items checked, ${brief.verification.downgraded.length} downgraded.`
	);
	if (brief.verification.downgraded.length > 0) {
		blank();
		for (const x of brief.verification.downgraded) {
			out.push(
				`- ${x.name} (${SECTION_TITLES[x.section as BriefSection] ?? x.section}): ${x.reason}`
			);
		}
	}

	// Sources (numbering finalised after the body has been rendered)
	if (includeSources) {
		const all = collectSourceRefs(brief);
		for (const ref of all) number(ref.toolCallId);
		if (all.length > 0) {
			heading(2, 'Sources');
			const ordered = [...all].sort((x, y) => number(x.toolCallId) - number(y.toolCallId));
			for (const ref of ordered) {
				const request = ref.requestKey.startsWith(ref.endpoint)
					? ref.requestKey
					: `${ref.endpoint} ${ref.requestKey}`;
				out.push(
					`- [S${number(ref.toolCallId)}] tool \`${ref.tool}\` -> \`GET ${request}\` (${ref.cacheHit ? 'cache hit' : 'live'}, fetched ${ref.fetchedAt})`
				);
			}
		}
	}

	if (options.includeTrace) {
		heading(2, 'Agent trace');
		out.push('Trace not embedded in this brief.');
	}

	return (
		out
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trimEnd() + '\n'
	);
}
