/**
 * Booking Brief -> Markdown. Pure and deterministic: no I/O, no clock, no
 * Node-only imports, so it can run in the browser.
 */
import {
	LINEUP_ARTIST_ONLY_NOTE,
	LINEUP_ARTIST_ONLY_SUBTITLE,
	lineupLocalityDifferentiated
} from './lineup';
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
import { RISK_SCORE_NOTE, riskLevelWord } from './risk-level';
import { buildDecisionSnapshot, NOT_AVAILABLE } from './snapshot';
import { VERDICT_LABEL, VERDICT_MEANING } from './verdict';

/**
 * Calibration copy, shared word for word with the section components so the web document and
 * the export say the same thing.
 */
export const CALIBRATION_COPY = {
	demand: 'Cultural affinity is not ticket demand.',
	pricing:
		'Illustrative planning scenarios, not ticket-price predictions. Validate against comparable shows, production costs, capacity and local sales history.',
	pricingContext:
		'Place price levels near the heat are consumption context, not the basis of the tiers.',
	sponsors:
		'Audience affinity identifies outreach prospects, not confirmed sponsors or budgets. Any proposal or activation remains subject to brand and artist approval.',
	venues:
		'Capacity, availability and rental cost are not in the data; confirm them with the venue.',
	drafts: 'Draft only; never sent.'
} as const;

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
		`${input.dateFrom} to ${input.dateTo} | Verdict: **${VERDICT_LABEL[draft.verdict]}** | ${draft.headline}`
	);

	// Decision snapshot: derived from the brief, never generated.
	const snap = buildDecisionSnapshot(brief);
	heading(2, 'Decision snapshot');
	out.push(`- Assessment: ${snap.assessment}`);
	const line = (l: { text: string; label?: Label; sources: string[] }) =>
		`${l.text}${l.label ? ` ${badge(l.label, l.sources)}` : ''}`;
	out.push(`- Cultural fit signal: ${line(snap.fitSignal)}`);
	if (snap.coverage) out.push(`- Highest-affinity neighbourhood: ${line(snap.coverage)}`);
	out.push(
		`- Top sponsor prospect: ${
			snap.topSponsor
				? `${snap.topSponsor.text} ${badge(snap.topSponsor.label ?? 'grounded', snap.topSponsor.sources)}`
				: NOT_AVAILABLE
		}`
	);
	out.push(`- Critical unknowns: ${snap.unknowns.join(' ')}`);
	out.push(`- Best next step: ${snap.nextStep}`);
	out.push(`- Confidence: ${snap.confidence.culturalText} ${snap.confidence.businessText}`);
	blank();
	out.push(`_${VERDICT_MEANING}_`);

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
		out.push(`_${CALIBRATION_COPY.demand}_`);
		blank();
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
		if (lineupLocalityDifferentiated(brief) === false) {
			out.push(`_${LINEUP_ARTIST_ONLY_SUBTITLE}: ${LINEUP_ARTIST_ONLY_NOTE}_`);
			blank();
		}
		note(draft.lineup.note);
		const pickLine = (p: ArtistPick) =>
			`- **${p.name}**${parenthesize([words(p.role), isPresent(p.affinity) ? `affinity ${num(p.affinity)}` : undefined])} ${badge(p.label, p.sources)}${suffix(p.why)}`;
		for (const p of draft.lineup.picks) out.push(pickLine(p));
		if (draft.lineup.picks.length > 0) blank();
	};

	renderers.sponsors = () => {
		heading(2, SECTION_TITLES.sponsors);
		out.push(`_${CALIBRATION_COPY.sponsors}_`);
		blank();
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
		out.push(`_${CALIBRATION_COPY.venues}_`);
		blank();
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
		out.push(`_${CALIBRATION_COPY.pricing}_`);
		blank();
		note(pr.note);
		if (pr.tiers.length > 0) {
			out.push(
				...table(
					['Tier', 'Price', 'Share', 'Rationale'],
					pr.tiers.map((t) => [t.name, `${t.price} ${pr.currency}`, pct(t.share), t.rationale])
				)
			);
			blank();
			out.push(CALIBRATION_COPY.pricingContext);
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
				`- **[severity ${r.severity}/5] ${words(r.category)}**: ${r.title}. So what: ${r.soWhat} Source: [${r.sourceName}](${r.sourceUrl})${r.publishedAt ? `, ${r.publishedAt.slice(0, 10)}` : ''} [${r.label}]`;
			for (const r of risks.items) out.push(riskLine(r));
			if (risks.items.length > 0) blank();
		}
		const feed = a.riskFeed;
		if (feed) {
			out.push(
				`Market risk score ${feed.score.value}/100 (${riskLevelWord(feed.score.value)}) from ${feed.score.itemCount} classified items (${feed.score.recentCount} in the last week)${feed.ingestedAt ? `, news ingested ${feed.ingestedAt.slice(0, 10)}` : ''}.${citeRef(feed.source)} ${RISK_SCORE_NOTE}`
			);
			if (feed.advisories.length) {
				blank();
				out.push('Travel advisories:');
				blank();
				for (const adv of feed.advisories)
					out.push(
						`- ${adv.source}${adv.level ? ` level ${adv.level}` : ''}: [${adv.title}](${adv.url})${adv.publishedAt ? `, ${adv.publishedAt.slice(0, 10)}` : ''}`
					);
			}
			blank();
		}
		const cal = a.marketCalendar;
		if (cal) {
			const inWindow = cal.holidays.filter((h) => h.inWindow);
			out.push(
				`Calendar${citeRef(cal.source)}: ${inWindow.length ? inWindow.map((h) => `${h.localName} (${h.weekday} ${h.date})`).join('; ') : 'no public holiday in the window'}${
					cal.longWeekends.some((l) => l.inWindow)
						? `; long weekend ${cal.longWeekends
								.filter((l) => l.inWindow)
								.map((l) => `${l.start} to ${l.end}`)
								.join(', ')}`
						: ''
				}.`
			);
			if (cal.climate) {
				const c = cal.climate;
				out.push(
					`Climate on these dates in ${c.years.length} previous years: highs ${num(c.tmaxMean, 1) ?? '-'} C, lows ${num(c.tminMean, 1) ?? '-'} C, ${num(c.precipMean, 1) ?? '-'} mm over the window, rain on ${c.rainDayShare != null ? Math.round(c.rainDayShare * 100) : '-'}% of days, wettest day ${num(c.precipMaxDay, 1) ?? '-'} mm. Not a forecast.`
				);
			}
			blank();
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
	out.push(`- Data requests: ${run.qlooCalls} (${run.qlooCacheHits} cache hits)`);
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
