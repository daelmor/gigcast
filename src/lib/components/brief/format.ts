export const pct = (v: number): string => `${Math.round(v * 100)}%`;
export const words = (v: string): string => v.replace(/_/g, ' ');
export const num = (v: number | null | undefined, digits = 2): string | undefined =>
	v !== null && v !== undefined && Number.isFinite(v) ? v.toFixed(digits) : undefined;

export function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? iso
		: d.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				timeZone: 'UTC'
			});
}

export function formatDateTime(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? iso
		: d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) +
				' UTC';
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms} ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)} s`;
	return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** Shared wording with the Markdown renderer. */
export const RISK_UNAVAILABLE =
	'The risk layer is not available in this build; nothing here is a safety judgment.';

export function ordinal(n: number): string {
	const v = Math.round(n) % 100;
	const suffix = ['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th';
	return `${Math.round(n)}${suffix}`;
}
