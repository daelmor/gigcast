/**
 * The badge tones of the design system and the one place that maps product states to them.
 * Verdicts and run statuses share the tones on purpose: positive and grounded mean "the data
 * backs this", caution and inferred mean "reasoning on top of it".
 */
import { riskLevelWord, type RiskLevelWord } from '$lib/brief/risk-level';
import type { Verdict } from '$lib/brief/verdict';

export type Tone = 'positive' | 'caution' | 'critical' | 'neutral' | 'live';

export const TONE_CLASSES: Record<Tone, string> = {
	positive: 'bg-positive-soft text-positive',
	caution: 'bg-caution-soft text-caution',
	critical: 'bg-critical-soft text-critical',
	neutral: 'bg-no-coverage-soft text-no-coverage',
	live: 'bg-beam text-on-beam'
};

// The verdict words live with the brief contract so the Markdown export says the same thing.
export { VERDICT_LABEL, type Verdict } from '$lib/brief/verdict';
export const VERDICT_TONE: Record<Verdict, Tone> = {
	promising: 'positive',
	mixed: 'caution',
	weak: 'critical',
	insufficient_data: 'neutral'
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

/** The risk score word and tone: quiet under 25, elevated under 60, high news volume otherwise. */
export function riskLevel(score: number): { word: RiskLevelWord; tone: Tone } {
	const word = riskLevelWord(score);
	return {
		word,
		tone: word === 'quiet' ? 'positive' : word === 'elevated' ? 'caution' : 'critical'
	};
}

export type Confidence = 'low' | 'medium' | 'high';
export const CONFIDENCE_TONE: Record<Confidence, Tone> = {
	low: 'neutral',
	medium: 'caution',
	high: 'positive'
};
