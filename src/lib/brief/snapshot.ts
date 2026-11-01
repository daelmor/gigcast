/**
 * The decision snapshot at the top of a brief: six lines a promoter can read in under a minute.
 * Every line is derived from fields already in the brief record; nothing here calls a model or
 * invents a number, and anything the brief does not carry renders as "Not available". Pure,
 * shared by the UI component and the Markdown renderer.
 */
import { rankNeighbourhoods } from './neighbourhoods';
import type { Brief, Label, PromoterInputs } from './schema';
import { VERDICT_LABEL, VERDICT_NEXT_STEP, type Verdict } from './verdict';

export const NOT_AVAILABLE = 'Not available';
export const SPONSOR_SUFFIX = 'audience affinity only; interest not confirmed';
export const NO_NEIGHBOURHOODS = 'No neighbourhood ranking available';

/** The five sections whose labels say how much cultural evidence the brief rests on. */
export const CULTURAL_SECTIONS = [
	'audience',
	'demandAndFit',
	'lineup',
	'sponsors',
	'venuesAndPartners'
] as const;

export type CulturalEvidence = 'strong' | 'mixed' | 'sparse';

/** How strong the chosen fit signal is: low below 0.30, moderate up to 0.60, strong above. */
export type SignalBand = 'low' | 'moderate' | 'strong';

export function signalBand(value: number): SignalBand {
	if (value < 0.3) return 'low';
	if (value <= 0.6) return 'moderate';
	return 'strong';
}

export interface SnapshotLine {
	text: string;
	label?: Label;
	/** Tool call ids behind the line, for the [S#] marks. */
	sources: string[];
}

export interface DecisionSnapshot {
	verdict: Verdict;
	/** Verdict label plus one clause from the headline. */
	assessment: string;
	headlineClause: string;
	/** Taste match, else the top neighbourhood, else the top brand affinity; with its band. */
	fitSignal: SnapshotLine & {
		kind: 'taste_match' | 'neighbourhood' | 'brand' | 'none';
		value?: number;
		band?: SignalBand;
	};
	/** Only when the fit signal is low: where any coverage is, from the neighbourhood ranking. */
	coverage?: SnapshotLine;
	topSponsor: (SnapshotLine & { name: string; affinity?: number }) | undefined;
	/** Deterministic, from what the promoter did not supply. */
	unknowns: string[];
	nextStep: string;
	confidence: {
		cultural: CulturalEvidence;
		grounded: number;
		noCoverage: number;
		culturalText: string;
		businessText: string;
	};
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const withBand = (v: number): string => `${pct(v)} (${signalBand(v)})`;

const CLAUSE_MAX = 160;

/**
 * One clause from the headline. Headlines usually read "Artist in City: claim — more claims";
 * the first clause after the colon is the claim, unless there is no title part.
 */
export function headlineClause(headline: string): string {
	const parts = headline
		.split(/\s+[—–]\s+|:\s+|;\s+|\s+\|\s+|\s+-\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length === 0) return '';
	let clause = parts[0];
	// "Artist in City (dates)" or a two-word label before the colon is a title, not the claim.
	const titleLike =
		parts.length > 1 &&
		parts[0].length < 70 &&
		(/\b(in|at)\b/i.test(parts[0]) || parts[0].split(/\s+/).length <= 3);
	if (titleLike) clause = parts[1];
	clause = clause.replace(/[.\s]+$/, '');
	if (clause.length > CLAUSE_MAX) {
		const cut = clause.slice(0, CLAUSE_MAX);
		clause = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`;
	}
	return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/** What the promoter did not supply, named by the real promoterInputs fields. */
export function criticalUnknowns(promoter: PromoterInputs | undefined): string[] {
	const out = ['Artist fee and availability: not in the data; request a quote and a hold.'];
	const hasCapacity = (promoter?.venues ?? []).some((v) => typeof v.capacity === 'number');
	if (!hasCapacity)
		out.push('Venue capacity: no venue with a capacity was supplied (venues[].capacity).');
	if (!promoter?.pastSales?.length)
		out.push('Comparable sales history: no past sales were supplied (pastSales).');
	if (!promoter?.ticketPriceRange)
		out.push('Ticket price range: no range was supplied (ticketPriceRange).');
	return out;
}

/** The neighbourhood line used both as a fit signal and as the coverage line under a low signal. */
function neighbourhoodLine(
	brief: Brief,
	mode: 'signal' | 'coverage'
): (SnapshotLine & { value: number }) | undefined {
	const hoods = brief.artifacts.neighbourhoods;
	if (!hoods || hoods.items.length === 0) return undefined;
	const ranking = rankNeighbourhoods(hoods.items);
	const top = ranking.items[0];
	const value = top.affinity;
	const amount = mode === 'signal' ? withBand(value) : pct(value);
	const text = ranking.flat
		? `Broad audience affinity across ${ranking.items.length} neighbourhoods at about ${amount}, with no meaningful differentiation`
		: mode === 'signal'
			? `Strongest neighbourhood: ${top.name}, affinity ${amount}`
			: `${top.name}, affinity ${amount}`;
	return { text, value, label: 'grounded', sources: [hoods.source.toolCallId] };
}

export function buildDecisionSnapshot(brief: Brief): DecisionSnapshot {
	const { draft, artifacts, input } = brief;
	const verdict = draft.verdict;
	const clause = headlineClause(draft.headline);
	const assessment = clause
		? `${VERDICT_LABEL[verdict]}. ${clause}.`
		: `${VERDICT_LABEL[verdict]}.`;

	// Cultural fit signal, in order of preference, from grounded data that is present.
	let fitSignal: DecisionSnapshot['fitSignal'] = { kind: 'none', text: NOT_AVAILABLE, sources: [] };
	const taste = draft.demandAndFit.tasteMatch;
	const hoodSignal =
		draft.audience.note.label === 'grounded' ? neighbourhoodLine(brief, 'signal') : undefined;
	if (taste && typeof taste.score === 'number' && taste.label === 'grounded') {
		fitSignal = {
			kind: 'taste_match',
			text: `Taste match with the city: ${withBand(taste.score)}`,
			value: taste.score,
			band: signalBand(taste.score),
			label: 'grounded',
			sources: [
				artifacts.artistTags?.source.toolCallId,
				artifacts.cityTags?.source.toolCallId
			].filter((x): x is string => !!x)
		};
	} else if (hoodSignal) {
		fitSignal = { kind: 'neighbourhood', band: signalBand(hoodSignal.value), ...hoodSignal };
	} else {
		const brand = draft.sponsors.picks.find(
			(p) => p.label === 'grounded' && typeof p.affinity === 'number'
		);
		if (brand) {
			const value = brand.affinity as number;
			fitSignal = {
				kind: 'brand',
				text: `Top brand affinity: ${brand.name} ${withBand(value)}`,
				value,
				band: signalBand(value),
				label: 'grounded',
				sources: brand.sources
			};
		}
	}

	// A low fit still has somewhere the affinity concentrates; show it next to the weak signal.
	let coverage: SnapshotLine | undefined;
	if (fitSignal.band === 'low') {
		const line = neighbourhoodLine(brief, 'coverage');
		coverage = line
			? { text: line.text, label: line.label, sources: line.sources }
			: { text: NO_NEIGHBOURHOODS, sources: [] };
	}

	const sponsor = draft.sponsors.picks.find((p) => p.label === 'grounded');
	const topSponsor = sponsor
		? {
				name: sponsor.name,
				affinity: sponsor.affinity,
				text: `${sponsor.name}${typeof sponsor.affinity === 'number' ? ` (affinity ${pct(sponsor.affinity)})` : ''}, ${SPONSOR_SUFFIX}`,
				label: 'grounded' as const,
				sources: sponsor.sources
			}
		: undefined;

	let grounded = 0;
	let noCoverage = 0;
	for (const section of CULTURAL_SECTIONS) {
		const label = draft[section].note.label;
		if (label === 'grounded') grounded++;
		if (label === 'no_coverage') noCoverage++;
	}
	const total = CULTURAL_SECTIONS.length;
	let cultural: CulturalEvidence =
		grounded === total ? 'strong' : noCoverage >= 2 || grounded <= 2 ? 'sparse' : 'mixed';
	// Five grounded sections do not make a weak fit strong: a low signal reads mixed at best.
	const lowSignal = fitSignal.band === 'low';
	if (lowSignal && cultural === 'strong') cultural = 'mixed';
	const culturalText = `Cultural evidence ${cultural}: ${grounded} of ${total} sections grounded${
		noCoverage ? `, ${noCoverage} with no coverage` : ''
	}${lowSignal ? ', but the cultural fit signal is low' : ''}.`;
	const businessText = input.promoter?.pastSales?.length
		? 'Business case not validated: promoter-supplied sales history is in the inputs but was not verified.'
		: 'Business case not validated: no sales history, fee, capacity or cost data in this brief.';

	return {
		verdict,
		assessment,
		headlineClause: clause,
		fitSignal,
		coverage,
		topSponsor,
		unknowns: criticalUnknowns(input.promoter),
		nextStep: VERDICT_NEXT_STEP[verdict],
		confidence: { cultural, grounded, noCoverage, culturalText, businessText }
	};
}
