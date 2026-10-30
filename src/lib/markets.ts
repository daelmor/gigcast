/**
 * Markets the app knows up front. The three featured ones are the demo
 * markets David confirmed after the M0 coverage probe; the others were probed
 * too and resolve to verified Qloo locality ids. Any other city Qloo covers
 * works through the locality search on /new. Shared by server and client.
 *
 * Locality ids come from docs/qloo-findings.md (resolved through /search with
 * a country check). `localityName` is what Qloo calls the locality; the seed
 * script refreshes it from /entities.
 */
export interface KnownMarket {
	/** Slug, also the `markets.id` column. */
	id: string;
	name: string;
	/** ISO 3166-1 alpha-2. */
	country: string;
	countryName: string;
	localityEntityId: string;
	localityName: string;
	lat: number;
	lon: number;
	timezone: string;
	/** Shown as a quick pick on /new. */
	featured: boolean;
	/** Artists with verified Qloo coverage, for placeholders and the demo briefs. */
	sampleArtists: string[];
	/** One line of context for the picker. */
	note?: string;
	/** Local outlets with RSS feeds for the risk layer (verified live on 2026-10-30 unless marked TODO). */
	outlets: Outlet[];
}

export interface Outlet {
	name: string;
	url: string;
	rss: string;
	/** Spanish or English content, for the classifier's benefit. */
	lang: 'es' | 'en';
}

export const KNOWN_MARKETS: KnownMarket[] = [
	{
		id: 'guatemala-city',
		name: 'Guatemala City',
		country: 'GT',
		countryName: 'Guatemala',
		localityEntityId: '3E843C82-ACFE-48BB-9C76-FC9A2781530D',
		localityName: 'Ciudad de Guatemala',
		lat: 14.6349,
		lon: -90.5069,
		timezone: 'America/Guatemala',
		featured: true,
		sampleArtists: ['Ricardo Arjona', 'Gaby Moreno', 'Alux Nahual', 'Bohemia Suburbana'],
		note: 'Deepest Central American coverage in the probe: 1,757 heatmap cells, regional artists resolve.',
		outlets: [
			{
				name: 'Prensa Libre',
				url: 'https://www.prensalibre.com',
				rss: 'https://www.prensalibre.com/feed/',
				lang: 'es'
			},
			{
				name: 'República',
				url: 'https://republica.gt',
				rss: 'https://republica.gt/feed',
				lang: 'es'
			},
			{
				name: 'Emisoras Unidas',
				url: 'https://emisorasunidas.com',
				rss: 'https://emisorasunidas.com/feed/',
				lang: 'es'
			}
			// TODO(David): Soy502 and elPeriódico have no working RSS at the usual paths; add if you know one.
		]
	},
	{
		id: 'santo-domingo',
		name: 'Santo Domingo',
		country: 'DO',
		countryName: 'Dominican Republic',
		localityEntityId: 'D25A3D1E-7CCC-457B-A823-F748F8577EBF',
		localityName: 'Santo Domingo',
		lat: 18.4861,
		lon: -69.9312,
		timezone: 'America/Santo_Domingo',
		featured: true,
		sampleArtists: ['Juan Luis Guerra', 'Romeo Santos', 'Natti Natasha', 'El Alfa'],
		note: 'Caribbean market with strong merengue, bachata and dembow signals.',
		outlets: [
			{
				name: 'Diario Libre',
				url: 'https://www.diariolibre.com',
				rss: 'https://www.diariolibre.com/rss/portada.xml',
				lang: 'es'
			},
			{ name: 'El Día', url: 'https://eldia.com.do', rss: 'https://eldia.com.do/feed/', lang: 'es' }
			// TODO(David): Listín Diario and El Caribe block or lack RSS; add a working feed if you have one.
		]
	},
	{
		id: 'mexico-city',
		name: 'Mexico City',
		country: 'MX',
		countryName: 'Mexico',
		localityEntityId: '6A479AAF-1D8D-4EA2-AC1E-29B0906063AC',
		localityName: 'Ciudad de México',
		lat: 19.4326,
		lon: -99.1332,
		timezone: 'America/Mexico_City',
		featured: true,
		sampleArtists: ['Natalia Lafourcade', 'Café Tacvba', 'Carín León', 'Zoé'],
		note: 'Large market that shows the product scaling up: 6,436 heatmap cells in the probe.',
		outlets: [
			{
				name: 'La Jornada',
				url: 'https://www.jornada.com.mx',
				rss: 'https://www.jornada.com.mx/rss/edicion.xml?v=1',
				lang: 'es'
			},
			{
				name: 'Expansión Política',
				url: 'https://politica.expansion.mx',
				rss: 'https://politica.expansion.mx/rss',
				lang: 'es'
			},
			{
				name: 'Chilango',
				url: 'https://www.chilango.com',
				rss: 'https://www.chilango.com/feed/',
				lang: 'es'
			}
			// TODO(David): El Universal, Milenio and Excélsior return 404 at the usual RSS paths.
		]
	},
	{
		id: 'panama-city',
		name: 'Panama City',
		country: 'PA',
		countryName: 'Panama',
		localityEntityId: 'B41D2DC7-98B6-46CE-B5DF-7F455F3CC105',
		localityName: 'Distrito Panamá',
		lat: 8.9824,
		lon: -79.5199,
		timezone: 'America/Panama',
		featured: false,
		sampleArtists: ['Rubén Blades', 'Sech', 'Boza', 'Los Rabanes'],
		note: 'Qloo calls the capital "Distrito Panamá"; the free-text "Panama City" is in Florida.',
		outlets: [
			{
				name: 'TVN Noticias',
				url: 'https://www.tvn-2.com',
				rss: 'https://www.tvn-2.com/rss',
				lang: 'es'
			}
			// TODO(David): La Prensa (Panamá) serves HTML at /feed/; add a working feed.
		]
	},
	{
		id: 'san-salvador',
		name: 'San Salvador',
		country: 'SV',
		countryName: 'El Salvador',
		localityEntityId: '675E9E0E-E3A6-4581-AE73-ABFF7C4801DE',
		localityName: 'San Salvador',
		lat: 13.6929,
		lon: -89.2182,
		timezone: 'America/El_Salvador',
		featured: false,
		sampleArtists: ['Álvaro Torres', 'Adhesivo', 'Frigüey'],
		// TODO(David): La Prensa Gráfica and elsalvador.com block feed requests; add 3 to 5 outlets.
		outlets: []
	},
	{
		id: 'managua',
		name: 'Managua',
		country: 'NI',
		countryName: 'Nicaragua',
		localityEntityId: 'F7D38B6B-1512-417E-9BAD-6482FE9EBAF9',
		localityName: 'Managua',
		lat: 12.115,
		lon: -86.2362,
		timezone: 'America/Managua',
		featured: false,
		sampleArtists: ['Luis Enrique', 'Katia Cardenal', 'Perrozompopo'],
		outlets: [
			{
				name: 'Confidencial',
				url: 'https://confidencial.digital',
				rss: 'https://confidencial.digital/feed/',
				lang: 'es'
			}
			// TODO(David): La Prensa (Nicaragua) returns 403 for feeds; add others.
		]
	}
];

export const FEATURED_MARKETS = KNOWN_MARKETS.filter((m) => m.featured);

export function findMarket(id: string | null | undefined): KnownMarket | undefined {
	return id ? KNOWN_MARKETS.find((m) => m.id === id) : undefined;
}
