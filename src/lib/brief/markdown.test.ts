import { describe, expect, it } from 'vitest';
import { sampleBrief } from './fixtures/sample-brief';
import { renderBriefMarkdown } from './markdown';
import type { Brief } from './schema';

const SECTION_TITLES = [
	'Audience map',
	'Demand and fit',
	'Lineup',
	'Sponsors',
	'Venues and partners',
	'Pricing guidance',
	'Risk panel'
];

function distinctToolCallIds(brief: Brief): string[] {
	const a = brief.artifacts;
	const refs = [
		a.heatmap?.source,
		a.neighbourhoods?.source,
		a.demographics?.source,
		a.trending?.source,
		a.artistTags?.source,
		a.cityTags?.source,
		a.cityArtists?.source,
		a.lineupCandidates?.source,
		a.sponsorCandidates?.source,
		...(a.placeCandidates ?? []).map((p) => p.source)
	];
	return [...new Set(refs.flatMap((r) => (r ? [r.toolCallId] : [])))];
}

describe('renderBriefMarkdown', () => {
	const md = renderBriefMarkdown(sampleBrief);

	it('renders the H1 and the seven section titles in order', () => {
		expect(md.startsWith('# Booking Brief: Ricardo Arjona in Guatemala City\n')).toBe(true);
		let cursor = md.indexOf('## Key points');
		expect(cursor).toBeGreaterThan(0);
		for (const title of [...SECTION_TITLES, 'Open questions', 'Method and sources', 'Sources']) {
			const next = md.indexOf(`\n## ${title}\n`, cursor);
			expect(next, title).toBeGreaterThan(cursor);
			cursor = next;
		}
	});

	it('shows every label badge type', () => {
		expect(md).toContain('**Grounded**');
		expect(md).toContain('**Inferred**');
		expect(md).toContain('**No coverage**');
		expect(md).toContain('[grounded]');
		expect(md).toContain('[inferred]');
	});

	it('puts each sponsor draft in a fenced text block', () => {
		for (const pick of sampleBrief.draft.sponsors.picks) {
			const block = `\`\`\`text\nSubject: ${pick.outreachDraft.subject}\n\n${pick.outreachDraft.body}\n\`\`\``;
			expect(md).toContain(block);
			expect(md).toContain(`### ${pick.name}`);
		}
		expect(md).toContain('never sent');
	});

	it('lists one source per distinct toolCallId and cites them in items', () => {
		const ids = distinctToolCallIds(sampleBrief);
		expect(ids.length).toBe(9);
		const sources = md.slice(md.indexOf('\n## Sources\n'));
		const lines = sources.split('\n').filter((l) => l.startsWith('- [S'));
		expect(lines).toHaveLength(ids.length);
		expect(lines[0]).toMatch(
			/^- \[S1\] tool `\w+` -> `GET \/v2\/insights\?.+` \((cache hit|live), fetched 2026-/
		);
		expect(md).toMatch(
			/\*\*Gaby Moreno\*\* \(co headliner, affinity 0\.89\) \[grounded\]\[S\d+\]: /
		);
	});

	it('is deterministic', () => {
		expect(renderBriefMarkdown(sampleBrief)).toBe(renderBriefMarkdown(sampleBrief));
	});

	it('removes Sources and markers when includeSources is false', () => {
		const out = renderBriefMarkdown(sampleBrief, { includeSources: false });
		expect(out).not.toContain('## Sources');
		expect(out).not.toMatch(/\[S\d+\]/);
	});

	it('appends the trace stub only when asked', () => {
		expect(md).not.toContain('Agent trace');
		expect(renderBriefMarkdown(sampleBrief, { includeTrace: true })).toContain(
			'## Agent trace\n\nTrace not embedded in this brief.'
		);
	});

	it('prints the risk layer sentence when draft.risks is undefined', () => {
		const brief: Brief = { ...sampleBrief, draft: { ...sampleBrief.draft, risks: undefined } };
		const out = renderBriefMarkdown(brief);
		expect(out).toContain('## Risk panel');
		expect(out).toContain(
			'The risk layer is not available in this build; nothing here is a safety judgment.'
		);
	});

	it('renders risk items when the layer has coverage', () => {
		const brief: Brief = {
			...sampleBrief,
			draft: {
				...sampleBrief.draft,
				risks: {
					note: { label: 'grounded', summary: 'One item.', caveats: [] },
					items: [
						{
							category: 'security',
							severity: 3,
							title: 'Protest announced',
							soWhat: 'Plan alternate access.',
							sourceName: 'Prensa',
							sourceUrl: 'https://example.com/a',
							publishedAt: '2026-10-29',
							label: 'grounded'
						}
					]
				}
			}
		};
		const out = renderBriefMarkdown(brief);
		expect(out).toContain(
			'- **[severity 3/5] security**: Protest announced. So what: Plan alternate access. Source: [Prensa](https://example.com/a), 2026-10-29'
		);
		expect(out).not.toContain('not available in this build');
	});

	it('opens with the decision snapshot and the calibrated verdict label', () => {
		expect(md).toContain('| Verdict: **Promising cultural fit** |');
		const snapshot = md.slice(md.indexOf('## Decision snapshot'), md.indexOf('## Key points'));
		expect(snapshot).toContain('- Assessment: Promising cultural fit. ');
		expect(snapshot).toMatch(
			/- Strongest cultural signal: Taste match with the city 86% \[grounded\]\[S\d+\]/
		);
		expect(snapshot).toContain(
			'- Top sponsor prospect: Adidas (affinity 91%), audience affinity only; interest not confirmed'
		);
		expect(snapshot).toContain('- Critical unknowns: Artist fee and availability');
		expect(snapshot).toContain(
			'- Best next step: Request venue availability and an artist fee quote before any sponsor outreach.'
		);
		expect(snapshot).toContain(
			'- Confidence: Cultural evidence strong: 5 of 5 sections grounded. Business case not validated'
		);
		expect(snapshot).toContain('never financial approval');
	});

	it('carries the calibration notes in the demand, lineup, sponsors, venues and pricing sections', () => {
		expect(md).toContain('_Cultural affinity is not ticket demand._');
		expect(md).toContain(
			'_Audience affinity identifies outreach prospects, not confirmed sponsors or budgets. Any proposal or activation remains subject to brand and artist approval._'
		);
		expect(md).toContain(
			'_Capacity, availability and rental cost are not in the data; confirm them with the venue._'
		);
		expect(md).toContain(
			'_Illustrative planning scenarios, not ticket-price predictions. Validate against comparable shows, production costs, capacity and local sales history._'
		);
		expect(md).toContain(
			'Place price levels near the heat are consumption context, not the basis of the tiers.'
		);
		// The fixture candidates carry no explainability, so no locality note is printed.
		expect(md).not.toContain('not locality-differentiated');
	});

	it('prints the artist-only lineup note when the explainability is the headliner alone', () => {
		const brief = structuredClone(sampleBrief);
		for (const c of brief.artifacts.lineupCandidates!.items)
			c.explainability = {
				'signal.interests.entities': [{ entityId: brief.resolution.artist.entityId, score: 1 }]
			};
		expect(renderBriefMarkdown(brief)).toContain(
			'_Artist compatibility (not locality-differentiated): '
		);
	});

	it('contains none of the forbidden demand, price, fee or commitment phrases', () => {
		for (const phrase of [
			/\baudience lives (here|in)\b/i,
			/\bdeep demand\b/i,
			/\baccepts? premium prices?\b/i,
			/\bcost-effective opener\b/i,
			/\bwill sponsor\b/i,
			/\bwe are producing\b/i,
			/\bwillingness to pay\b/i,
			/\bQloo\b/
		])
			expect(md, String(phrase)).not.toMatch(phrase);
	});

	it('never prints undefined or null', () => {
		expect(md).not.toMatch(/undefined|null|NaN/);
		const sparse: Brief = {
			...sampleBrief,
			artifacts: { calls: [] },
			draft: {
				...sampleBrief.draft,
				risks: undefined,
				demandAndFit: { note: sampleBrief.draft.demandAndFit.note },
				openQuestions: []
			}
		};
		expect(renderBriefMarkdown(sparse, { includeTrace: true })).not.toMatch(/undefined|null|NaN/);
	});
});
