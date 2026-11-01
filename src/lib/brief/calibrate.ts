/**
 * Read-time calibration of a stored brief, so briefs generated before the prompt changed read
 * like new ones without a migration: provider wording, overclaim rewrites, calendar context kept
 * out of the risk items and neighbourhoods deduped. Pure; the store applies it in getBriefRecord.
 */
import { dedupeNeighbourhoods } from './neighbourhoods';
import { feedUrlKeys, splitCalendarRiskItems } from './risk-items';
import type { Brief } from './schema';
import { calibrateProse } from './wording';

export function calibrateBrief(brief: Brief): Brief {
	const out = calibrateProse(brief);
	if (out.draft.risks && out.draft.risks.items.length > 0) {
		const known = out.artifacts.riskFeed ? feedUrlKeys(out.artifacts.riskFeed) : undefined;
		out.draft.risks.items = splitCalendarRiskItems(out.draft.risks.items, known).kept;
	}
	if (out.artifacts.neighbourhoods) {
		out.artifacts.neighbourhoods = {
			...out.artifacts.neighbourhoods,
			items: dedupeNeighbourhoods(out.artifacts.neighbourhoods.items)
		};
	}
	return out;
}
