import { describe, expect, it } from 'vitest';
import { calibrateBrief } from './calibrate.ts';
import { sampleBrief } from './fixtures/sample-brief.ts';
import { renderBriefMarkdown } from './markdown.ts';
import type { Brief } from './schema.ts';

/** A stored brief as the planner wrote them before the calibration pass. */
function legacyBrief(): Brief {
	const brief = structuredClone(sampleBrief);
	brief.draft.sponsors.picks[0].outreachDraft.body =
		'Hi [Name],\n\nWe are producing a Ricardo Arjona concert in Guatemala City on [Date].';
	brief.draft.audience.note.summary = "Qloo's heatmap shows where the audience lives in Zona 10.";
	brief.draft.risks!.items.push({
		category: 'weather_climate',
		severity: 2,
		title: 'Late November climate: dry season',
		soWhat: 'Plan for cool evenings.',
		sourceName: 'Open-Meteo ERA5 archive',
		sourceUrl: 'https://open-meteo.com',
		label: 'inferred'
	});
	brief.artifacts.neighbourhoods = {
		items: [
			{ entityId: 'n1', name: 'Zona 10', affinity: 0.9 },
			{ entityId: 'n2', name: 'Zona 10', affinity: 0.8 },
			{ entityId: 'n3', name: 'Zona 4', affinity: 0.85 }
		],
		source: sampleBrief.artifacts.heatmap!.source
	};
	return brief;
}

describe('calibrateBrief', () => {
	it('rewrites the overclaims and the provider name in stored prose', () => {
		const out = calibrateBrief(legacyBrief());
		expect(out.draft.sponsors.picks[0].outreachDraft.body).toContain(
			'We are exploring a potential Ricardo Arjona concert'
		);
		expect(out.draft.audience.note.summary).toBe(
			"The taste graph's heatmap shows where the audience affinity concentrates in Zona 10."
		);
	});

	it('keeps calendar context out of the risk items and leaves feed items alone', () => {
		const before = legacyBrief();
		const out = calibrateBrief(before);
		expect(out.draft.risks!.items.map((i) => i.sourceName)).not.toContain(
			'Open-Meteo ERA5 archive'
		);
		expect(out.draft.risks!.items).toHaveLength(before.draft.risks!.items.length - 1);
		// Identifiers and urls are untouched.
		expect(out.draft.risks!.items[0].sourceUrl).toBe(before.draft.risks!.items[0].sourceUrl);
	});

	it('dedupes neighbourhoods by name, keeping the highest affinity', () => {
		const out = calibrateBrief(legacyBrief());
		expect(out.artifacts.neighbourhoods!.items).toEqual([
			{ entityId: 'n1', name: 'Zona 10', affinity: 0.9 },
			{ entityId: 'n3', name: 'Zona 4', affinity: 0.85 }
		]);
	});

	it('does not change a brief that is already calibrated', () => {
		expect(calibrateBrief(sampleBrief)).toEqual(sampleBrief);
		expect(renderBriefMarkdown(calibrateBrief(sampleBrief))).toBe(renderBriefMarkdown(sampleBrief));
	});
});
