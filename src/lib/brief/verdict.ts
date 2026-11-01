/**
 * The verdict vocabulary, shared by the Markdown renderer, the UI tones map and the decision
 * snapshot. A verdict describes preliminary cultural fit; it is never a financial approval, and
 * the labels say so. No Svelte or server imports here.
 */
export const VERDICTS = ['promising', 'mixed', 'weak', 'insufficient_data'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
	promising: 'Promising cultural fit',
	mixed: 'Conditional — verify before booking',
	weak: 'Weak cultural fit',
	insufficient_data: 'Insufficient evidence'
};

/** One fixed sentence per verdict for the decision snapshot. */
export const VERDICT_NEXT_STEP: Record<Verdict, string> = {
	promising: 'Request venue availability and an artist fee quote before any sponsor outreach.',
	mixed:
		'Validate the cultural fit against comparable shows and local sales history before committing dates or budget.',
	weak: 'Do not start sponsor outreach on this evidence; consider another market, date or format.',
	insufficient_data:
		'Run the brief again or supply promoter inputs; the taste graph returned too little to assess this market.'
};

export const VERDICT_MEANING =
	'The verdict describes preliminary cultural fit, never financial approval. No coverage never means low demand.';

export function isVerdict(value: unknown): value is Verdict {
	return typeof value === 'string' && (VERDICTS as readonly string[]).includes(value);
}
