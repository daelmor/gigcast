/**
 * Markets the app knows up front. The six featured ones are the demo markets
 * David chose on 2026-10-30 (three in Latin America, three in the United
 * States); the Central American ones were the first probe's markets and stay
 * known so their briefs and dashboards keep working. Every id below resolves
 * to a verified locality in the taste graph. Any other city the graph covers
 * works through the locality search on /new. Shared by server and client.
 *
 * Locality ids come from docs/qloo-findings.md (resolved through /search with
 * a country check). `localityName` is what the graph calls the locality; the
 * seed script refreshes it from /entities.
 */
export type NewsLang = 'es' | 'en' | 'pt';

export interface KnownMarket {
	/** Slug, also the `markets.id` column. */
	id: string;
	name: string;
	/** ISO 3166-1 alpha-2. */
	country: string;
	countryName: string;
	/** Grouping on the landing page. */
	region: 'latam' | 'us';
	localityEntityId: string;
	localityName: string;
	lat: number;
	lon: number;
	timezone: string;
	/** Language of the local press, for the Google News searches of the risk layer. */
	lang: NewsLang;
	/** Shown as a quick pick on /new and on the landing page. */
	featured: boolean;
	/** Artists with verified coverage in the taste graph, for placeholders and the demo briefs. */
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
	/** Language of the feed, for the classifier's benefit. */
	lang: NewsLang;
}

export const KNOWN_MARKETS: KnownMarket[] = [
	// Latin America -----------------------------------------------------------
	{
		id: 'mexico-city',
		name: 'Mexico City',
		country: 'MX',
		countryName: 'Mexico',
		region: 'latam',
		localityEntityId: '6A479AAF-1D8D-4EA2-AC1E-29B0906063AC',
		localityName: 'Ciudad de México',
		lat: 19.4326,
		lon: -99.1332,
		timezone: 'America/Mexico_City',
		lang: 'es',
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
		id: 'sao-paulo',
		name: 'São Paulo',
		country: 'BR',
		countryName: 'Brazil',
		region: 'latam',
		localityEntityId: '87DE0F46-8AF7-449B-8369-CC2296578282',
		localityName: 'São Paulo',
		lat: -23.6505,
		lon: -46.6484,
		timezone: 'America/Sao_Paulo',
		lang: 'pt',
		featured: true,
		sampleArtists: ['Criolo', 'Caetano Veloso', 'Liniker', 'Gloria Groove'],
		note: 'Largest Brazilian market: 1,224 heatmap cells in the probe; tropicália, Brazilian rock and MPB names resolve.',
		outlets: [
			{
				name: 'Folha de S.Paulo',
				url: 'https://www1.folha.uol.com.br',
				rss: 'https://feeds.folha.uol.com.br/cotidiano/rss091.xml',
				lang: 'pt'
			},
			{
				name: 'Estadão',
				url: 'https://www.estadao.com.br',
				rss: 'https://www.estadao.com.br/arc/outboundfeeds/rss/?outputType=xml',
				lang: 'pt'
			},
			{
				name: 'CNN Brasil',
				url: 'https://www.cnnbrasil.com.br',
				rss: 'https://cnnbrasil.com.br/feed/',
				lang: 'pt'
			}
			// G1 São Paulo's feed is stale (newest item 2018) and UOL returns 403.
		]
	},
	{
		id: 'buenos-aires',
		name: 'Buenos Aires',
		country: 'AR',
		countryName: 'Argentina',
		region: 'latam',
		localityEntityId: 'AC7D5EB0-92E9-4EF6-8243-81AA6853143E',
		localityName: 'Buenos Aires',
		lat: -34.6144,
		lon: -58.446,
		timezone: 'America/Argentina/Buenos_Aires',
		lang: 'es',
		featured: true,
		sampleArtists: ['Dante Spinetta', 'Emmanuel Horvilleur', 'Marilina Bertoldi', 'LOUTA'],
		note: '3,886 heatmap cells in the probe; rock argentino and rock en español lead the city tags.',
		outlets: [
			{
				name: 'Clarín',
				url: 'https://www.clarin.com',
				rss: 'https://www.clarin.com/rss/lo-ultimo/',
				lang: 'es'
			},
			{
				name: 'La Nación',
				url: 'https://www.lanacion.com.ar',
				rss: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml',
				lang: 'es'
			},
			{
				name: 'Infobae',
				url: 'https://www.infobae.com',
				rss: 'https://www.infobae.com/arc/outboundfeeds/rss/',
				lang: 'es'
			}
			// Página/12 has no feed at /rss/portada (404).
		]
	},
	// United States -----------------------------------------------------------
	{
		id: 'new-york-city',
		name: 'New York City',
		country: 'US',
		countryName: 'United States',
		region: 'us',
		localityEntityId: '81E61924-6CEE-4AB4-93D3-282A5C784AB8',
		localityName: 'New York',
		lat: 40.6632,
		lon: -73.9389,
		timezone: 'America/New_York',
		lang: 'en',
		featured: true,
		sampleArtists: ['Solange', 'Lizzo', 'Janelle Monáe', 'Beyoncé'],
		note: '1,356 heatmap cells in the probe; Broadway, cabaret and disco lead the city tags.',
		outlets: [
			{
				name: 'Gothamist',
				url: 'https://gothamist.com',
				rss: 'https://gothamist.com/feed',
				lang: 'en'
			},
			{ name: 'amNY', url: 'https://www.amny.com', rss: 'https://www.amny.com/feed/', lang: 'en' },
			{
				name: 'New York Post',
				url: 'https://nypost.com/metro/',
				rss: 'https://nypost.com/metro/feed/',
				lang: 'en'
			}
			// NY Daily News returns 403; Patch and Time Out have no feed at the usual paths.
		]
	},
	{
		id: 'los-angeles',
		name: 'Los Angeles',
		country: 'US',
		countryName: 'United States',
		region: 'us',
		localityEntityId: '10F17338-97FE-40A3-9434-F6D59F000A9E',
		localityName: 'Los Angeles',
		lat: 34.1982,
		lon: -118.2611,
		timezone: 'America/Los_Angeles',
		lang: 'en',
		featured: true,
		sampleArtists: ['Gwen Stefani', 'Pharrell Williams', 'Diplo', 'Lizzo'],
		note: 'Widest US coverage in the probe: 4,405 heatmap cells; new wave, post-punk and hip hop tags.',
		outlets: [
			{ name: 'LAist', url: 'https://laist.com', rss: 'https://laist.com/index.rss', lang: 'en' },
			{
				name: 'Los Angeles Times',
				url: 'https://www.latimes.com/california',
				rss: 'https://www.latimes.com/california/rss2.0.xml',
				lang: 'en'
			},
			{ name: 'KTLA', url: 'https://ktla.com', rss: 'https://ktla.com/feed/', lang: 'en' }
			// LA Daily News and Los Angeles Magazine return 403; L.A. Taco serves HTML at /feed.
		]
	},
	{
		id: 'tampa',
		name: 'Tampa',
		country: 'US',
		countryName: 'United States',
		region: 'us',
		localityEntityId: 'CF0B5657-4CBE-4B3F-9476-57644B5C87A1',
		localityName: 'Tampa',
		lat: 27.9953,
		lon: -82.4443,
		timezone: 'America/New_York',
		lang: 'en',
		featured: true,
		sampleArtists: ['Plies', 'Rick Ross', 'T.I.', 'Jessie James Decker'],
		note: '754 heatmap cells in the probe; contemporary country and country-pop lead the city tags.',
		outlets: [
			{
				name: 'Tampa Bay Times',
				url: 'https://www.tampabay.com',
				rss: 'https://www.tampabay.com/arc/outboundfeeds/rss/?outputType=xml',
				lang: 'en'
			},
			{ name: 'WFLA', url: 'https://www.wfla.com', rss: 'https://www.wfla.com/feed/', lang: 'en' },
			{
				name: 'FOX 13 Tampa Bay',
				url: 'https://www.fox13news.com',
				rss: 'https://www.fox13news.com/rss/category/news',
				lang: 'en'
			}
			// Tampa Bay Business Journal sits behind a Cloudflare challenge; Bay News 9 serves HTML.
		]
	},
	// Central America and the Caribbean: the first probe's markets, kept for existing briefs.
	{
		id: 'guatemala-city',
		name: 'Guatemala City',
		country: 'GT',
		countryName: 'Guatemala',
		region: 'latam',
		localityEntityId: '3E843C82-ACFE-48BB-9C76-FC9A2781530D',
		localityName: 'Ciudad de Guatemala',
		lat: 14.6349,
		lon: -90.5069,
		timezone: 'America/Guatemala',
		lang: 'es',
		featured: false,
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
		region: 'latam',
		localityEntityId: 'D25A3D1E-7CCC-457B-A823-F748F8577EBF',
		localityName: 'Santo Domingo',
		lat: 18.4861,
		lon: -69.9312,
		timezone: 'America/Santo_Domingo',
		lang: 'es',
		featured: false,
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
		id: 'panama-city',
		name: 'Panama City',
		country: 'PA',
		countryName: 'Panama',
		region: 'latam',
		localityEntityId: 'B41D2DC7-98B6-46CE-B5DF-7F455F3CC105',
		localityName: 'Distrito Panamá',
		lat: 8.9824,
		lon: -79.5199,
		timezone: 'America/Panama',
		lang: 'es',
		featured: false,
		sampleArtists: ['Rubén Blades', 'Sech', 'Boza', 'Los Rabanes'],
		note: 'The graph calls the capital "Distrito Panamá"; the free-text "Panama City" is in Florida.',
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
		region: 'latam',
		localityEntityId: '675E9E0E-E3A6-4581-AE73-ABFF7C4801DE',
		localityName: 'San Salvador',
		lat: 13.6929,
		lon: -89.2182,
		timezone: 'America/El_Salvador',
		lang: 'es',
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
		region: 'latam',
		localityEntityId: 'F7D38B6B-1512-417E-9BAD-6482FE9EBAF9',
		localityName: 'Managua',
		lat: 12.115,
		lon: -86.2362,
		timezone: 'America/Managua',
		lang: 'es',
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

export const REGION_NAMES: Record<KnownMarket['region'], string> = {
	latam: 'Latin America',
	us: 'United States'
};

export function findMarket(id: string | null | undefined): KnownMarket | undefined {
	return id ? KNOWN_MARKETS.find((m) => m.id === id) : undefined;
}
