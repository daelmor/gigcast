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
