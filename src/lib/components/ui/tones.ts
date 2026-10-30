/**
 * The badge tones of the design system and the one place that maps product states to them.
 * Verdicts and run statuses share the tones on purpose: positive and grounded mean "the data
 * backs this", caution and inferred mean "reasoning on top of it".
 */
export type Tone = 'positive' | 'caution' | 'critical' | 'neutral' | 'live';

export const TONE_CLASSES: Record<Tone, string> = {
	positive: 'bg-positive-soft text-positive',
	caution: 'bg-caution-soft text-caution',
	critical: 'bg-critical-soft text-critical',
	neutral: 'bg-no-coverage-soft text-no-coverage',
	live: 'bg-beam text-on-beam'
};

export type Verdict = 'promising' | 'mixed' | 'weak' | 'insufficient_data';
export const VERDICT_TONE: Record<Verdict, Tone> = {
	promising: 'positive',
	mixed: 'caution',
	weak: 'critical',
	insufficient_data: 'neutral'
};
export const VERDICT_LABEL: Record<Verdict, string> = {
	promising: 'Promising',
	mixed: 'Mixed',
	weak: 'Weak',
	insufficient_data: 'Insufficient data'
};

export type RunStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed';
export const STATUS_TONE: Record<RunStatus, Tone> = {
	queued: 'neutral',
	running: 'live',
	complete: 'positive',
	partial: 'caution',
	failed: 'critical'
};
export const STATUS_LABEL: Record<RunStatus, string> = {
	queued: 'Queued',
	running: 'Running',
	complete: 'Complete',
	partial: 'Partial',
	failed: 'Failed'
};

/** The risk score word and tone: quiet under 25, watch under 60, loud otherwise. */
export function riskLevel(score: number): { word: 'quiet' | 'watch' | 'loud'; tone: Tone } {
	if (score < 25) return { word: 'quiet', tone: 'positive' };
	if (score < 60) return { word: 'watch', tone: 'caution' };
	return { word: 'loud', tone: 'critical' };
}

export type Confidence = 'low' | 'medium' | 'high';
export const CONFIDENCE_TONE: Record<Confidence, Tone> = {
	low: 'neutral',
	medium: 'caution',
	high: 'positive'
};
