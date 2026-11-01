/**
 * Market risk score: severity-weighted, confidence-weighted, time-decayed
 * sum of classified items, squashed into 0 to 100. Pure.
 *
 * The score is a news-volume signal, not a safety level: the words are quiet,
 * elevated and high news volume (src/lib/brief/risk-level.ts).
 *
 * TODO(calibration): the sum is absolute, so a dense-media city (New York
 * City scored 100 from 145 stored items) reads "high news volume" on an
 * ordinary week while a market with three outlets never leaves "quiet". The
 * real fix is to normalize the weighted sum by the market's own baseline (the
 * ingested items per day over the trailing weeks, or the median weight of its
 * feed), so the score is relative to each city rather than to the feed size.
 * Deferred on 2026-11-01; see docs/decisions.md.
 */
import type { RiskScore } from '../../brief/schema.ts';

const DAY = 86_400_000;

export function ageDays(publishedAt: string | null, now: Date): number {
	if (!publishedAt) return 30;
	const t = Date.parse(publishedAt);
	if (Number.isNaN(t)) return 30;
	return Math.max(0, (now.getTime() - t) / DAY);
}

/**
 * ((severity - 1) / 4)^1.5 x confidence x 0.5^(age / halfLife), clamped to 0..1.
 * Severity 2 counts little (0.125), 3 some (0.35), 4 a lot (0.65), 5 fully.
 */
export function decayWeight(
	severity: number,
	confidence: number,
	age: number,
	halfLifeDays = 14
): number {
	const s = (Math.min(5, Math.max(1, severity)) - 1) / 4;
	const w =
		Math.pow(s, 1.5) * Math.min(1, Math.max(0, confidence)) * Math.pow(0.5, age / halfLifeDays);
	return Math.round(Math.min(1, Math.max(0, w)) * 1000) / 1000;
}

/**
 * 0..100 from a sum of weights. A quiet week of severity-2 items stays under 25;
 * a couple of fresh severity-4 items read as "elevated"; a dense feed of severe items reads
 * "high news volume".
 */
export function squash(sum: number): number {
	return Math.round(100 * (1 - Math.exp(-sum / 4)));
}

export interface ScoredItem {
	category: string;
	weight: number;
	publishedAt: string | null;
}

export function riskScore(items: ScoredItem[], now: Date): RiskScore {
	const byCategorySum = new Map<string, number>();
	let sum = 0;
	let recentCount = 0;
	for (const item of items) {
		sum += item.weight;
		byCategorySum.set(item.category, (byCategorySum.get(item.category) ?? 0) + item.weight);
		if (ageDays(item.publishedAt, now) <= 7) recentCount++;
	}
	const byCategory: Record<string, number> = {};
	for (const [category, s] of byCategorySum) byCategory[category] = squash(s);
	return { value: squash(sum), byCategory, itemCount: items.length, recentCount };
}
