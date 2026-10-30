/**
 * The design tokens as resolved colours, for libraries that cannot read CSS custom properties
 * themselves (ECharts, MapLibre). `theme` is runes state that changes when the theme switches
 * (data-theme attribute or the OS preference), so charts and maps can re-render from it.
 */
export const COLOR_TOKENS = [
	'surface',
	'surface-raised',
	'surface-sunken',
	'line',
	'line-strong',
	'ink',
	'ink-muted',
	'ink-subtle',
	'signal',
	'signal-soft',
	'action',
	'pulse',
	'beam',
	'beam-text',
	'night',
	'grounded',
	'inferred',
	'no-coverage',
	'positive',
	'caution',
	'critical',
	'heat-1',
	'heat-2',
	'heat-3',
	'heat-4',
	'heat-5',
	'chart-1',
	'chart-2',
	'chart-3',
	'chart-muted'
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ThemeColors = Record<ColorToken, string>;

export interface ThemeState {
	/** Resolved scheme, from the `color-scheme` the token file sets on the root. */
	scheme: 'light' | 'dark';
	colors: ThemeColors;
	fonts: { sans: string; mono: string; display: string };
	/** Increments on every change; handy as an effect dependency. */
	version: number;
}

function read(): ThemeState {
	const root = document.documentElement;
	const style = getComputedStyle(root);
	const colors = Object.fromEntries(
		COLOR_TOKENS.map((t) => [t, style.getPropertyValue(`--${t}`).trim()])
	) as ThemeColors;
	const scheme = style.colorScheme.includes('dark') ? 'dark' : 'light';
	return {
		scheme,
		colors,
		fonts: {
			sans: style.getPropertyValue('--font-sans').trim(),
			mono: style.getPropertyValue('--font-mono').trim(),
			display: style.getPropertyValue('--font-display').trim()
		},
		version: 0
	};
}

const fallback: ThemeState = {
	scheme: 'light',
	colors: Object.fromEntries(COLOR_TOKENS.map((t) => [t, ''])) as ThemeColors,
	fonts: { sans: 'sans-serif', mono: 'monospace', display: 'sans-serif' },
	version: 0
};

export const theme = $state<ThemeState>(fallback);

let started = false;

/** Start watching once, in the browser. Safe to call from any component's onMount. */
export function watchTheme(): void {
	if (started || typeof document === 'undefined') return;
	started = true;
	const refresh = () => {
		const next = read();
		theme.scheme = next.scheme;
		theme.colors = next.colors;
		theme.fonts = next.fonts;
		theme.version += 1;
	};
	refresh();
	new MutationObserver(refresh).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme']
	});
	const media = window.matchMedia('(prefers-color-scheme: dark)');
	media.addEventListener('change', refresh);
	// Fonts and tokens may settle after first paint.
	document.fonts?.ready.then(refresh).catch(() => undefined);
}

/** Current colours; starts the watcher if needed. */
export function themeColors(): ThemeColors {
	watchTheme();
	return theme.colors;
}

/** `#rrggbb` (or `#rgb`) to `rgba(r,g,b,a)`; passes other strings through untouched. */
export function withAlpha(color: string, alpha: number): string {
	const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m) return color;
	let hex = m[1];
	if (hex.length === 3)
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
	const n = parseInt(hex, 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
