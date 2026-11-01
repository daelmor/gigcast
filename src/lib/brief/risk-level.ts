/**
 * The market risk score bands. The score is a news-volume signal: a severity-weighted,
 * time-decayed sum of classified headlines squashed to 0..100. Dense-media cities read higher by
 * default, so the words name volume, never danger. Pure, shared by the UI, the Markdown and the
 * market dashboard.
 */
export type RiskLevelWord = 'quiet' | 'elevated' | 'high news volume';

/** Thresholds unchanged from the first calibration: under 25, under 60, otherwise. */
export function riskLevelWord(value: number): RiskLevelWord {
	return value < 25 ? 'quiet' : value < 60 ? 'elevated' : 'high news volume';
}

export const RISK_SCORE_NOTE =
	'A news-volume signal for this market over the last weeks. Dense-media cities read higher by default; it is not a safety judgment.';
