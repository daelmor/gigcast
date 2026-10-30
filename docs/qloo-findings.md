# Qloo API findings (M0 probe)

Generated 2026-10-30T08:37:51.321Z by `scripts/qloo-probe.ts` against `https://hackathon.api.qloo.com`. 236 requests (236 replayed from the local cache), 219 returned 200, median latency 261 ms, p90 1282 ms. Responses fetched between 2026-10-30T08:28:50.594Z and 2026-10-30T08:30:47.701Z. Rate-limit headers seen: `{"x-month-ratelimit-limit":"50000","x-month-ratelimit-remaining":"49558","x-month-ratelimit-reset":"2591057.32","x-second-ratelimit-limit":"10","x-second-ratelimit-remaining":"9","x-second-ratelimit-reset":"1"}`.

Everything below is observed behavior from live responses on the date above. Where the public docs or the kickoff brief disagree with what the API did, the API wins. Raw request log: `docs/qloo-probe-log.json`. Trimmed samples (test fixtures): `docs/qloo-samples/`. Full bodies: `.cache/qloo-probe/` (gitignored).

## 1. Coverage table

Anchor taste signal for every market: the resolved `Bad Bunny` entity. "Locality resolved" is the `/search` locality the probe accepted after checking the country in its disambiguation (see the attempts list in Observations); "(id)" columns use `filter.location=<that entity id>`, "(query)" columns use `filter.location.query=<city, country>` and the next column shows what Qloo resolved that free text to. Bars, hotels, night clubs, concert halls and stadiums are `filter.tags` counts with the id filter; `take=50`, so 50 means "at least 50". Heatmap counts are geohash cells. "City artists/tags" use the city as the only signal (`signal.location=<id>`). "Regional resolved" counts the market's own artists found through `/search`; "Regional affinity" is the number of similar artists Qloo returns for the first regional artist found.

| Market | Locality resolved (id) | Free-text query resolved to | Places (id) | Places (query) | Places (no signal) | Bars | Hotels | Night clubs | Concert halls | Stadiums | Price level % | Rating % | Brands (loc.) | Heatmap (id) | Heatmap (query) | Heatmap (point 25 km) | City artists | City tags | Regional resolved | Regional affinity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Guatemala City | Ciudad de Guatemala (Ciudad de Guatemala, Departamento de Guatemala, Guatemala) | Guatemala City (Guatemala City, Guatemala Department, Guatemala) | 50 | 50 | 50 | 50 | 50 | 1 | 0 | 3 | 24% | 86% | 20 (J=0.82) | 855 | 855 | 545 | 20 | 20 | 5/5 | 10 (Ricardo Arjona) |
| San Salvador | Departamento de San Salvador (Departamento de San Salvador, El Salvador) | San Salvador (San Salvador, El Salvador) | 50 | 50 | 50 | 42 | 50 | 3 | 1 | 1 | 28% | 98% | 20 (J=0.43) | 184 | 184 | 307 | 20 | 20 | 3/5 | 10 (Alvaro Torres) |
| Panama City | Distrito Panamá (Distrito Panamá, Provincia de Panamá, Panama) | Panama City Beach (Panama City Beach, Bay County, Florida, United States) | 50 | 50 | 50 | 50 | 50 | 2 | 2 | 3 | 14% | 88% | 20 (J=0.29) | 338 | 77 | 491 | 20 | 20 | 5/5 | 10 (Rubén Blades) |
| Santo Domingo | Santo Domingo (Santo Domingo, República Dominicana) | Santo Domingo (Santo Domingo, Dominican Republic) | 50 | 50 | 50 | 50 | 50 | 0 | 0 | 0 | 20% | 96% | 20 (J=0.43) | 451 | 451 | 622 | 20 | 20 | 5/5 | 10 (Juan Luis Guerra) |
| Managua | Managua (Managua, Nicaragua) | Managua (Managua, Nicaragua) | 50 | 50 | 50 | 46 | 50 | 0 | 1 | 0 | 34% | 98% | 20 (J=0.74) | 249 | 249 | 265 | 20 | 20 | 4/5 | 10 (Luis Enrique) |
| Mexico City | Ciudad de México (Ciudad de México, Benito Juárez, Ciudad de México, México) | Mexico City (Mexico City, Mexico) | 50 | 50 | 50 | 50 | 50 | 38 | 15 | 9 | 10% | 96% | 20 (J=0.54) | 6436 | 1066 | 1759 | 20 | 20 | 5/5 | 10 (Natalia Lafourcade) |
| Miami (control) | Miami (Miami, Miami-Dade, Florida, United States of America) | Miami-Dade County (Miami-Dade County, Florida, United States) | 50 | 50 | 50 | 50 | 50 | 28 | 3 | 2 | 2% | 98% | 20 (J=0.05) | 1418 | 1585 | 1215 | 20 | 20 | 5/5 | 10 (Pitbull) |

J = Jaccard similarity between the location-biased brand list and the global brand list for the same artist (1.00 means the location signal changed nothing).

### Samples per market

| Market | Locality id | Location param used | Place samples (artist signal) | Brand samples (loc. signal) | City artist samples | City tag samples | Heatmap cell query keys |
|---|---|---|---|---|---|---|---|
| Guatemala City | 3E843C82-ACFE-48BB-9C76-FC9A2781530D | locality entity id | Bazar Casa Vieja \| La Pradera; November; 15 Avenida 5 calle | Adidas; Puma; Converse | Gaby Moreno; Ricardo Arjona; Carl Nunes; Francis Davila; Carlos Pena | guatemala; Cuban Music; Human Experience; Ballad; Latin Culture | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| San Salvador | 675E9E0E-E3A6-4581-AE73-ABFF7C4801DE | locality entity id | La Pizzería - Multiplaza; Canal 12; Instituto Superior de Economía y Administración de Empresas (ISEADE) - FEPADE | Adidas; Converse; Tommy Hilfiger | Residente; Ricky Martin; Britney Spears; Thalía; Gianluca Vacchi | Psychology; Education; Politics; Latin Rock; Political Activism | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| Panama City | B41D2DC7-98B6-46CE-B5DF-7F455F3CC105 | locality entity id | PH Splendor By The Park; Megapolis Hotel Panamá; ATM Global Bank - Cinépolis Multiplaza | Converse; Tommy Hilfiger; Calvin Klein | Rubén Blades; Marko; Erika Ender; Nacho; Los Rabanes | Salsa; salsa; bulgarian; Latin Jazz;  czech | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| Santo Domingo | D25A3D1E-7CCC-457B-A823-F748F8577EBF | locality entity id | Salon De Eventos Vista Marina; EGO - ZONA COLONIAL; Arroyo Hondo | Puma; Nike; Converse | Don Miguelo; El Alfa; La Insuperable; Mozart la Para; El Mayor Clasico | dominican republic; Merengue; dembow; Dominican; Dembow | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| Managua | F7D38B6B-1512-417E-9BAD-6482FE9EBAF9 | locality entity id | The Market; Café Las Flores Galerías; Nejapa Golf & Country Club | Adidas; Puma; Nike | Katia Cardenal; Daddy Yankee; Manelyk; Nicky Jam; J Balvin | Reggaeton; spanish; nicaragua; latin pop; Latin American Folk | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| Mexico City | 6A479AAF-1D8D-4EA2-AC1E-29B0906063AC | locality entity id | Yo Elijo Ser Feliz; Heavens Rock Life; TUDN (TelevisaUnivision Deportes Networks) | Adidas; Puma; Converse | Natalia Lafourcade; Belinda; Ximena Sariñana; ximena; Maria León | Latin Rock; México; spanish; mexican; Rock en Espanol | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |
| Miami (control) | 548C4D6F-B7A6-4E24-BE32-63D04B889827 | locality entity id | Bayside Marketplace; Kaseya Center; Miami International Airport | Louis Vuitton; Reebok; Forever 21 | Bad Bunny; Marko; J Balvin; Gianluca Vacchi; Nicky Jam | Tropical; Puerto Rico; Salsa; cubaton; salsa | affinity, affinity_rank, popularity, entity_artist_affinity_rank, entity_artist_affinity |

## 2. Artist resolution through `/search`

"Found" means the top result name matches the query after accent and case folding. Popularity is Qloo's 0–1 percentile.

### Global and regional artists

| Query | Market | Found | Top result | Entity id | Popularity | Disambiguation |
|---|---|---|---|---|---|---|
| Bad Bunny | global | yes | Bad Bunny | BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 | 0.994 | Bad Bunny |
| Karol G | global | yes | Karol G | 658495BB-DF77-472E-A6B2-9E37FF248FB3 | 0.983 | Karol G |
| Coldplay | global | yes | Coldplay | B6FA456F-B729-4700-B01F-E82AD3AC8ADA | 1.000 | Coldplay |
| Shakira | global | yes | Shakira | 58F3AF6B-EC34-4BFC-B345-F4210EDE4C43 | 0.999 | Shakira |
| Daddy Yankee | global | yes | Daddy Yankee | 007C6FE0-7F4B-4F5F-AAEE-6A1133BBE16D | 0.996 | Daddy Yankee |
| Feid | global | yes | Feid | 3A191450-43F7-4FBA-B9B1-4269D812E030 | 0.939 | Feid |
| Rauw Alejandro | global | yes | Rauw Alejandro | 77A93A61-4A62-4466-B031-B9CC7485AA56 | 0.967 | Rauw Alejandro |
| Grupo Frontera | global | yes | Grupo Frontera | 2D9E6DE0-C560-4E95-B5D1-A44D6357D399 | 0.287 | Grupo Frontera |
| Peso Pluma | global | yes | Peso Pluma | CC64E9A6-0432-47EA-9877-071FF8F413C4 | 0.222 | Peso Pluma |
| Taylor Swift | global | yes | Taylor Swift | 4BBEF799-A0C4-4110-AB01-39216993C312 | 1.000 | Taylor Swift |
| Álvaro Torres | San Salvador | yes | Alvaro Torres | EDB73239-1DDE-4986-B144-B1A637B62CAC | 0.735 | Alvaro Torres |
| Adhesivo | San Salvador | yes | Adhesivo | 5AAA1D4C-2BFD-475D-B1D8-E3EAF5F59666 | 0.537 | Adhesivo |
| Frigüey | San Salvador | NO | – | – | – | – |
| Los Hermanos Flores | San Salvador | yes | Los Hermanos Flores | 975740FC-0DE8-4848-8FB2-0A4B09103EEF | 0.582 | Los Hermanos Flores |
| Shaka y Dres | San Salvador | NO | Your Yellow Dress | 6E197B6A-F845-4E49-BD4E-823846ED97F1 | 0.566 | Your Yellow Dress |
| Ricardo Arjona | Guatemala City | yes | Ricardo Arjona | CA98034C-6AD8-44AA-898E-038495C4E116 | 0.988 | Ricardo Arjona |
| Gaby Moreno | Guatemala City | yes | Gaby Moreno | 27B180A1-3E0A-4340-81A3-57FB51816E2D | 0.894 | Gaby Moreno |
| Alux Nahual | Guatemala City | yes | Alux Nahual | E29B0DC4-D3B7-45C6-84E0-E3762FE14C67 | 0.758 | Alux Nahual |
| Bohemia Suburbana | Guatemala City | yes | Bohemia Suburbana | DE6DDFEA-E568-47F6-9176-9AAFDAFD213C | 0.824 | Bohemia Suburbana |
| Viernes Verde | Guatemala City | yes | Viernes Verde | B50AA982-30F0-437C-934A-EF7521E5D779 | 0.642 | Viernes Verde |
| Rubén Blades | Panama City | yes | Rubén Blades | 6571A368-6BAB-47CD-A6F4-588FB61CA4F7 | 0.962 | Rubén Blades |
| Sech | Panama City | yes | Sech | 43AAE2EA-3E8D-4FA8-A401-791B9A4F639D | 0.940 | Sech |
| Boza | Panama City | yes | Boza | 56CA00B5-D363-4C97-B123-788490F6D67B | 0.768 | Boza |
| Joey Montana | Panama City | yes | Joey Montana | 2FAB11CF-40A6-458F-A1F1-373BDCB271BF | 0.931 | Joey Montana |
| Los Rabanes | Panama City | yes | Los Rabanes | 1E5EA6FE-FD7E-4D15-BF7C-0E76157519E8 | 0.897 | Los Rabanes |
| Juan Luis Guerra | Santo Domingo | yes | Juan Luis Guerra | CE06DC03-AD08-4767-96EC-29D752216CC5 | 0.986 | Juan Luis Guerra |
| Romeo Santos | Santo Domingo | yes | Romeo Santos | 4E98364C-4184-412C-BAB3-06A75E63C90B | 0.981 | Romeo Santos |
| Natti Natasha | Santo Domingo | yes | Natti Natasha | 478AC207-ABCB-4E6D-A904-E2DBDABA4B01 | 0.948 | Natti Natasha |
| El Alfa | Santo Domingo | yes | El Alfa | AEBBAB82-E25F-4BC0-8DA8-6A4E59DCACC8 | 0.920 | El Alfa |
| Aventura | Santo Domingo | yes | Aventura | 4E0C3846-41D5-4415-837E-6E11B611E7AC | 0.990 | Aventura |
| Luis Enrique | Managua | yes | Luis Enrique | 82E64972-BCB9-40E4-A4CE-4A33812F81DC | 0.951 | Luis Enrique |
| Carlos Mejía Godoy | Managua | yes | Carlos Mejía Godoy | 60161661-9B62-47D8-88C3-5339218BF201 | 0.657 | Carlos Mejía Godoy |
| Perrozompopo | Managua | yes | PerroZompopo | A93F482A-1082-40A5-BDE6-E400BA78BE7C | 0.735 | PerroZompopo |
| Katia Cardenal | Managua | yes | Katia Cardenal | 56C1714C-CB38-489C-A640-25AB05D84010 | 0.619 | Katia Cardenal |
| Dimensión Costeña | Managua | NO | The 5th Dimension | A2838695-634C-4A78-9625-11DB74A945BB | 0.972 | The 5th Dimension |
| Natalia Lafourcade | Mexico City | yes | Natalia Lafourcade | 7FDE68C0-E3AE-418B-8527-DBFA9F972971 | 0.990 | Natalia Lafourcade |
| Café Tacvba | Mexico City | yes | Café Tacvba | E6722960-A6DC-4A0F-8BE2-3DE1DEF2100F | 0.993 | Café Tacvba |
| Carín León | Mexico City | yes | Carin Leon | 7DF5243E-88CC-401E-B92B-9DC8B58D47D0 | 0.610 | Carin Leon |
| Zoé | Mexico City | yes | Zoé | D1F94361-9D3D-4AE3-9049-0BDBB1C88673 | 0.992 | Zoé |
| Los Ángeles Azules | Mexico City | yes | Los Angeles Azules | 326D12E3-4D8C-4B1F-8BD4-50811C311919 | 0.954 | Los Angeles Azules |
| Pitbull | Miami (control) | yes | Pitbull | 8223F4C7-4D91-4042-8A2B-F83C699B27E0 | 0.999 | Pitbull |
| Gloria Estefan | Miami (control) | yes | Gloria Estefan | A9114A4E-E117-401E-8C03-54BB748FC1FF | 0.989 | Gloria Estefan |
| Camila Cabello | Miami (control) | yes | Camila Cabello | AE8A7A8E-A9C6-42E4-9204-A3D15E933D63 | 0.995 | Camila Cabello |
| Nicky Jam | Miami (control) | yes | Nicky Jam | FA5306E4-2B86-4880-90BC-7ABFA876EA39 | 0.987 | Nicky Jam |
| Marc Anthony | Miami (control) | yes | Marc Anthony | EB98D052-8860-4C68-9B73-CAFDEF7A3AE6 | 0.991 | Marc Anthony |

## 3. Parameter behavior per entity type

Each experiment adds one parameter to the group baseline. Similarity is the Jaccard index between result names with and without the parameter: 1.00 means the parameter was silently ignored.

| Group | Parameter | Status | Count | Similarity to baseline | Verdict |
|---|---|---|---|---|---|
| place (Mexico City, anchor artist signal) | baseline | 200 | 20 | – | - |
| place (Mexico City, anchor artist signal) | filter.price_level.min=3 | 200 | 20 | 0.03 | changes results |
| place (Mexico City, anchor artist signal) | filter.price_level.max=1 | 200 | 20 | 0.00 | changes results |
| place (Mexico City, anchor artist signal) | filter.popularity.min=0.8 | 200 | 20 | 0.43 | changes results |
| place (Mexico City, anchor artist signal) | filter.rating.min=4.5 | 200 | 20 | 0.33 | changes results |
| place (Mexico City, anchor artist signal) | filter.tags=<bar> | 200 | 20 | 0.08 | changes results |
| place (Mexico City, anchor artist signal) | filter.exclude.tags=<bar> | 200 | 20 | 0.74 | minor reordering / partial change |
| place (Mexico City, anchor artist signal) | signal.demographics.age=36_to_55 | 200 | 20 | 0.00 | changes results |
| place (Mexico City, anchor artist signal) | page=2 | 200 | 20 | 0.00 | changes results |
| place (Mexico City, anchor artist signal) | filter.bogus_parameter=1 (expect ignored) | 200 | 20 | 1.00 | no effect (identical results) |
| place by WKT point (Mexico City) | baseline | 200 | 20 | – | - |
| place by WKT point (Mexico City) | filter.location.radius=2000 | 200 | 20 | 0.05 | changes results |
| place by WKT point (Mexico City) | filter.location.radius=50000 | 200 | 20 | 0.48 | changes results |
| artist (anchor artist signal) | baseline | 200 | 20 | – | - |
| artist (anchor artist signal) | signal.demographics.age=36_to_55 | 200 | 20 | 0.00 | changes results |
| artist (anchor artist signal) | signal.demographics.age=24_and_younger | 200 | 20 | 0.67 | minor reordering / partial change |
| artist (anchor artist signal) | signal.demographics.gender=female | 200 | 20 | 0.18 | changes results |
| artist (anchor artist signal) | signal.location.query=Mexico City | 200 | 20 | 0.21 | changes results |
| artist (anchor artist signal) | signal.location.query=Guatemala City | 200 | 20 | 0.21 | changes results |
| artist (anchor artist signal) | filter.popularity.min=0.9 | 200 | 20 | 0.90 | minor reordering / partial change |
| artist (anchor artist signal) | filter.tags=<reggaeton> | 200 | 20 | 0.60 | minor reordering / partial change |
| artist (anchor artist signal) | filter.location.query=Mexico City (expect ignored) | 200 | 20 | 1.00 | no effect (identical results) |
| artist (anchor artist signal) | filter.price_level.min=3 (expect ignored) | 200 | 20 | 1.00 | no effect (identical results) |
| brand (anchor artist signal) | baseline | 200 | 20 | – | - |
| brand (anchor artist signal) | signal.demographics.age=36_to_55 | 200 | 20 | 0.18 | changes results |
| brand (anchor artist signal) | signal.demographics.gender=female | 200 | 20 | 0.18 | changes results |
| brand (anchor artist signal) | signal.location.query=Mexico City | 200 | 20 | 0.54 | changes results |
| brand (anchor artist signal) | filter.popularity.min=0.5 | 200 | 20 | 0.90 | minor reordering / partial change |
| brand (anchor artist signal) | filter.location.query=Mexico City (expect ignored) | 200 | 20 | 1.00 | no effect (identical results) |

## 4. Trends, compare, analysis endpoints (paths confirmed live)

| Probe | Endpoint | Params | Status | Count | Message / first result keys |
|---|---|---|---|---|---|
| trends.v2-category | /v2/trends/category | type=urn:entity:artist take=5 | 404 | – | The requested resource could not be found. |
| trends.v2-trending | /v2/trending | filter.type=urn:entity:artist take=5 | 400 | – | signal.interests.entities is required; filter.start_date is required; filter.end_date is required |
| trends.v1-category | /trends/category | type=urn:entity:artist take=5 | 404 | – | The requested resource could not be found. |
| trends.v2-entity | /v2/trends/entity | entity_id=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 start_date=2026-08-01 end_date=2026-10-29 | 404 | – | The requested resource could not be found. |
| trends.bias | /v2/insights | filter.type=urn:entity:artist signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 bias.trends=high take=5 | 200 | 5 | name, entity_id, type, subtype, properties, popularity, tags, query, disambiguation, external |
| compare.v2-artist | /v2/insights/compare | a.signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 b.signal.interests.entities=B6FA456F-B729-4700-B01F-E82AD3AC8ADA filter.type=urn:entity:artist take=5 | 200 | 38 | tag_id, name, type, subtype, entity_id, popularity, query |
| compare.v2-tag | /v2/insights/compare | a.signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 b.signal.interests.entities=B6FA456F-B729-4700-B01F-E82AD3AC8ADA filter.type=urn:tag take=5 | 200 | 38 | tag_id, name, type, subtype, entity_id, popularity, query |
| analysis.v1 | /analysis | entity_ids=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3,B6FA456F... filter.type=urn:entity:artist take=5 | 404 | – | The requested resource could not be found. |
| analysis.v2 | /v2/analysis | entity_ids=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3,B6FA456F... filter.type=urn:entity:artist take=5 | 404 | – | Route not found |
| analysis.v1-compare | /analysis/compare | entities.a=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3 entities.b=B6FA456F-B729-4700-B01F-E82AD3AC8ADA filter.type=urn:entity:artist | 404 | – | The requested resource could not be found. |

## 5. Observations

Hackathon base URL `https://hackathon.api.qloo.com` answered 200 with 2 results; production base `https://api.qloo.com` answered 401 (Unauthorized). A wrong base URL is the usual cause of 401.

`/search` parameter variants (which `types` spelling works):

| params | status | count | first result (types) |
|---|---|---|---|
| `query=Bad Bunny types=urn:entity:artist take=3` | 200 | 3 | Bad Bunny (urn:entity:artist) |
| `query=Bad Bunny types=artist take=3` | 400 | - | types/0:  must be equal to one of the allowed values: urn:entity:actor, urn:entity:album, urn:entity:artist, urn:entity:author, urn:entity:book, urn:entity:brand, urn:entity:destination, urn:entity:director, urn:entity:locality, urn:entity:movie, urn:entity:person, urn:entity:place, urn:entity:podcast, urn:entity:tv_show, urn:entity:videogame, urn:demographics, urn:tag |
| `query=Bad Bunny filter.type=urn:entity:artist take=3` | 200 | 3 | Bad Bunny (urn:entity:artist) |
| `query=Bad Bunny take=3` | 200 | 3 | Bad Bunny (urn:entity:person) |

Anchor artist for all coverage calls: Bad Bunny (`BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3`).

Tag IDs resolved through `/v2/tags` (used by the coverage calls below):

| query | tag id | name | type |
|---|---|---|---|
| bar | `urn:tag:genre:place:restaurant:bar` | Bar | urn:tag:genre:place |
| hotel | `urn:tag:genre:place:hotel` | Hotel | urn:tag:genre:place |
| restaurant | `urn:tag:genre:place:restaurant` | Restaurant | urn:tag:genre:place |
| night club | `urn:tag:category:place:night_club` | Night club | urn:tag:category:place |
| concert hall | `urn:tag:category:place:concert_hall` | Concert hall | urn:tag:category:place |
| stadium | `urn:tag:category:place:stadium` | Stadium | urn:tag:category:place |
| arena | `urn:tag:category:place:arena` | Arena | urn:tag:category:place |
| theater | `urn:tag:offerings:place:theater` | Theater | urn:tag:offerings:place |
| performing arts theater | `urn:tag:category:place:performing_arts_theater` | Performing arts theater | urn:tag:category:place |
| event venue | `urn:tag:category:place:event_venue` | Event venue | urn:tag:category:place |
| live music venue | `urn:tag:genre:place:live_music_venue` | Live music venue | urn:tag:genre:place |
| reggaeton | `urn:tag:genre:music:reggaeton` | Reggaeton | urn:tag:genre:music |

Heatmap `heatmap.dimensions=quality,popularity,price_level` (as described in the kickoff brief) returned 1227 cells with status 200; cell keys: ["affinity","affinity_rank","popularity","entity_artist_affinity_rank","entity_artist_affinity","quality_affinity_rank","popularity_affinity_rank","price_level_affinity_rank","price_level_total_count","quality_affinity","popularity_affinity","price_level_affinity"].

Heatmap with `signal.location.query` instead of `filter.location.query`: status 400, 0 cells (at least one valid signal and filter.location or filter.location.query is required for heatmap insight).

Heatmap with `output.heatmap.boundary=locality`: status 400, 0 cells (output.heatmap.boundary must be "urn:geohash" or "urn:entity:locality").

`/v2/trending` requires `signal.interests.entities`, `filter.type`, `filter.start_date` and `filter.end_date`. Calendar year 2025, artist: status 200, 5 results. Aug–Oct 2026, artist: status 200, 0 results (the series lags the present). 2025, brand: status 200, 0 results.

Heatmap with `output.heatmap.boundary=urn:entity:locality`: status 200, 57 results.

`/v2/insights/compare` artist vs. city (`b.signal.location.query`): status 400, 0 shared tags (b.signal.interests.entities is required).

Error behavior for common mistakes:

| request | status | count | message |
|---|---|---|---|
| filter.type=urn:entity:music (should be artist) | 400 | - | The value urn:entity:music is not supported for filter.type |
| filter.type=urn:entity:food_and_drink (should be place or brand) | 400 | - | The value urn:entity:food_and_drink is not supported for filter.type |
| missing filter.type | 400 | - | filter.type is required |
| no signal and no filter | 400 | - | at least one valid signal or filter is required for entity insights |
| unknown entity id as signal | 400 | - | the signal.interests.entities parameter contains invalid entity ids |

Locality disambiguation: `/search?query=Panama City&types=urn:entity:locality` returned: Panama City (Panama City, Bay, Florida, United States of America); Panama City Beach (Panama City Beach, Bay, Florida, United States of America); Harrison Place (Harrison Place, Panama City, Bay, Florida, United States of America). Always pass "city, country" or use the locality entity id.

Locality resolution attempts through `/search?types=urn:entity:locality` (query -> top 3 candidates), and which candidate the probe accepted:

- **San Salvador** -> picked "Departamento de San Salvador" (Departamento de San Salvador, El Salvador) via query "San Salvador, El Salvador". Attempts: "San Salvador, El Salvador" -> Departamento de San Salvador (Departamento de San Salvador, El Salvador); Municipio de San Salvador (Municipio de San Salvador, Departamento de San Salvador, El Salvador); San Salvador el Verde (San Salvador el Verde, Puebla, México)
- **Guatemala City** -> picked "Ciudad de Guatemala" (Ciudad de Guatemala, Departamento de Guatemala, Guatemala) via query "Guatemala City, Guatemala". Attempts: "Guatemala City, Guatemala" -> Ciudad de Guatemala (Ciudad de Guatemala, Departamento de Guatemala, Guatemala); Guatemala (Guatemala); Liverpool City Region (Liverpool City Region, England, United Kingdom)
- **Panama City** -> picked "Distrito Panamá" (Distrito Panamá, Provincia de Panamá, Panama) via query "Distrito Panamá". Attempts: "Panama City, Panama" -> Panama City Beach (Panama City Beach, Bay, Florida, United States of America); Panama City (Panama City, Bay, Florida, United States of America); Harrison Place (Harrison Place, Panama City, Bay, Florida, United States of America) | "Distrito Panamá" -> Distrito Panamá (Distrito Panamá, Provincia de Panamá, Panama); Distrito David (Distrito David, Chiriquí, Panama); Distrito San Miguelito (Distrito San Miguelito, Provincia de Panamá, Panama)
- **Santo Domingo** -> picked "Santo Domingo" (Santo Domingo, República Dominicana) via query "Santo Domingo, Dominican Republic". Attempts: "Santo Domingo, Dominican Republic" -> Santo Domingo (Santo Domingo, República Dominicana); Santo Domingo de Guzmán (Santo Domingo de Guzmán, Distrito Nacional, República Dominicana); Santo Domingo Este (Santo Domingo Este, Santo Domingo, República Dominicana)
- **Managua** -> picked "Managua" (Managua, Nicaragua) via query "Managua, Nicaragua". Attempts: "Managua, Nicaragua" -> Managua (Managua, Nicaragua); Managua (Municipio) (Managua (Municipio), Managua, Nicaragua); Distrito I (Distrito I, Managua (Municipio), Managua, Nicaragua)
- **Mexico City** -> picked "Ciudad de México" (Ciudad de México, Benito Juárez, Ciudad de México, México) via query "Mexico City, Mexico". Attempts: "Mexico City, Mexico" -> Ciudad de México (Ciudad de México, Benito Juárez, Ciudad de México, México); Silver City (Silver City, Grant, New Mexico, United States of America); Centro (Centro, Municipio de Los Cabos, Baja California Sur, México)
- **Miami (control)** -> picked "Miami" (Miami, Miami-Dade, Florida, United States of America) via query "Miami, Florida". Attempts: "Miami, Florida" -> Miami-Dade (Miami-Dade, Florida, United States of America); Miami (Miami, Miami-Dade, Florida, United States of America); Miami Beach (Miami Beach, Miami-Dade, Florida, United States of America)

Places by locality id vs. by free-text query: id returned more in 0 markets, query in 0, equal in 7.

17 of 236 requests returned a non-200 status (expected ones included: production base URL, invalid types, missing signals, path trials).

## 6. Endpoint response shapes (observed)

Skeletons: values replaced by their JSON type, arrays reduced to their first item, short strings kept as examples. Full trimmed samples live in `docs/qloo-samples/<probe id>.json`.

### /search (artist)

Probe `auth.hackathon` · status 200 · 2 results · Entity resolution. Note the `types` array on each result and the `disambiguation` string.

```
GET /search?query=Bad Bunny&types=urn:entity:artist&take=2
```

```json
{
  "results": [
    {
      "name": "string \"Bad Bunny\"",
      "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
      "types": [
        "string \"urn:entity:artist\""
      ],
      "properties": {
        "akas": [],
        "duration": {},
        "external": {
          "facebook": {
            "id": "string \"badbunnyofficial\""
          },
          "instagram": {
            "id": "string \"badbunnypr\""
          },
          "lastfm": {
            "id": "string \"bad%20bunny\"",
            "listeners": "number",
            "scrobbles": "number"
          },
          "musicbrainz": {
            "id": "string \"89aa5ecb-59ad-46f5-b3eb-2d424e941f19\""
          },
          "spotify": {
            "id": "string \"4q3ewBCX7sLwd24euuV69X\""
          },
          "twitter": {
            "id": "string \"sanbenito\""
          },
          "wikidata": {
            "id": "string \"q44333953\""
          }
        },
        "image": {
          "url": "string"
        },
        "short_description": "string"
      },
      "popularity": "number",
      "disambiguation": "string \"Bad Bunny\"",
      "tags": [
        {
          "name": "string \"Latin\"",
          "tag_id": "string \"urn:tag:genre:latin\"",
          "type": "string \"urn:tag:genre\"",
          "value": "string \"urn:tag:genre:latin\""
        },
        "... 45 more"
      ]
    },
    "... 1 more"
  ]
}
```

### /search on the production base URL (expected rejection)

Probe `auth.production` · status 401 · no results array

```
GET /search?query=Bad Bunny&types=urn:entity:artist&take=2
```

```json
{
  "error": {
    "reason": "string \"Invalid API Key\"",
    "message": "string \"Unauthorized\"",
    "code": "number"
  }
}
```

### /v2/tags (place tags)

Probe `tags.place.bar` · status 200 · 10 results · Tag resolution for place categories.

```
GET /v2/tags?filter.query=bar&filter.parents.types=urn:entity:place&take=10
```

```json
{
  "duration": "number",
  "success": "boolean",
  "results": {
    "tags": [
      {
        "parents": [
          {
            "type": "string \"urn:entity:place\""
          }
        ],
        "type": "string \"urn:tag:genre:place\"",
        "id": "string \"urn:tag:genre:place:restaurant:bar\"",
        "name": "string \"Bar\"",
        "popularity": "number",
        "properties": {
          "description": "string",
          "history": "string",
          "origin": "string \"Ancient world\"",
          "presentation_style": "string \"Casual\""
        },
        "tags": [
          {
            "name": "string \"Canonical\"",
            "tag_id": "string \"urn:tag:collection:canonical\"",
            "type": "string \"urn:tag:collection\"",
            "value": "string \"urn:tag:collection:canonical\""
          }
        ]
      },
      "... 9 more"
    ]
  }
}
```

### /v2/tags (music genre)

Probe `tags.music.reggaeton` · status 200 · 3 results · Genre tag resolution for artists.

```
GET /v2/tags?filter.query=reggaeton&filter.parents.types=urn:entity:artist&take=10
```

```json
{
  "duration": "number",
  "success": "boolean",
  "results": {
    "tags": [
      {
        "parents": [
          {
            "type": "string \"urn:entity:artist\""
          },
          "... 1 more"
        ],
        "type": "string \"urn:tag:genre:music\"",
        "id": "string \"urn:tag:genre:music:reggaeton\"",
        "name": "string \"Reggaeton\"",
        "popularity": "number",
        "properties": {
          "description": "string",
          "history": "string",
          "melody": "string \"Repetitive and catchy\"",
          "performance": "string \"Lively and dance-oriented performances\"",
          "rhythm": "string \"Rhythm is usually defined by dembow beat\"",
          "tempo": "string \"Moderate to high\"",
          "vocals": "string"
        },
        "tags": []
      },
      "... 2 more"
    ]
  }
}
```

### /v2/insights artist -> artist with explainability

Probe `similar.anchor` · status 200 · 10 results · Lineup candidates. Look for the explainability block per entity.

```
GET /v2/insights?filter.type=urn:entity:artist&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&take=10&feature.explainability=true
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Tainy\"",
        "entity_id": "string \"B7E0DE43-AF9C-45A2-B721-04C762B2E995\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:artist\"",
        "properties": {
          "akas": [
            "{...}",
            "... 1 more"
          ],
          "image": {
            "url": "string"
          },
          "aliases": [
            "string \"Tainy\""
          ],
          "members": [],
          "is_group": "boolean",
          "biography": "string",
          "known_for": "string",
          "start_year": "number",
          "description": "string",
          "instruments": [
            "string \"Digital Audio Workstation\"",
            "... 2 more"
          ],
          "collaborators": [
            "string \"Bad Bunny\"",
            "... 4 more"
          ],
          "date_of_birth": "string \"1989-08-09\"",
          "influenced_by": [
            "string \"Luny Tunes\"",
            "... 2 more"
          ],
          "notable_songs": [
            "string \"Callaíta\"",
            "... 4 more"
          ],
          "lyrical_themes": [
            "string \"Love\"",
            "... 4 more"
          ],
          "place_of_birth": "string \"San Juan, Puerto Rico\"",
          "primary_genres": [
            "string \"Reggaeton\"",
            "... 1 more"
          ],
          "characteristics": [
            "string \"Innovative\"",
            "... 4 more"
          ],
          "cultural_impact": "string",
          "obscurity_scale": [
            "string \"3\""
          ],
          "secondary_genres": [
            "string \"Trap Latino\"",
            "... 2 more"
          ],
          "associated_brands": [
            "string \"Sony Music Latin\"",
            "... 1 more"
          ],
          "genres_influenced": [
            "string \"Reggaeton\"",
            "... 2 more"
          ],
          "performance_style": "string",
          "artists_influenced": [
            "string \"Bad Bunny\"",
            "... 2 more"
          ],
          "short_descriptions": [
            "{...}",
            "... 3 more"
          ],
          "adjectives_for_fans": [
            "string \"Passionate\"",
            "... 3 more"
          ],
          "adjectives_for_music": [
            "string \"Catchy\"",
            "... 4 more"
          ],
          "lyrical_themes_description": "string",
          "adjectives_for_performance_style": [
            "string \"Dynamic\"",
            "... 2 more"
          ],
          "creative_and_specific_adjectives_for_music": [
            "string \"Reggaeton\"",
            "... 4 more"
          ]
        },
        "popularity": "number",
        "tags": [
          {
            "id": "string \"urn:tag:style:qloo:electro_latin\"",
            "name": "string \"Electro Latin\"",
            "type": "string \"urn:tag:style:qloo\""
          },
          "... 48 more"
        ],
        "query": {
          "affinity": "number",
          "measurements": {
            "audience_growth": "number"
          },
          "explainability": {
            "signal.interests.entities": [
              "{...}"
            ]
          }
        },
        "disambiguation": "string \"Tainy\"",
        "external": {
          "imdb": [
            "{...}"
          ],
          "lastfm": [
            "{...}"
          ],
          "spotify": [
            "{...}"
          ],
          "twitter": [
            "{...}",
            "... 1 more"
          ],
          "facebook": [
            "{...}"
          ],
          "wikidata": [
            "{...}"
          ],
          "instagram": [
            "{...}",
            "... 1 more"
          ],
          "musicbrainz": [
            "{...}"
          ]
        }
      },
      "... 9 more"
    ]
  },
  "query": {
    "explainability": {
      "signal.interests.entities": {
        "effect_on_top3_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top5_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top10_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_all_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ]
      }
    }
  }
}
```

### /v2/insights artist -> brand with explainability

Probe `brands.anchor.global` · status 200 · 20 results · Sponsor candidates, no location signal.

```
GET /v2/insights?filter.type=urn:entity:brand&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&take=20&feature.explainability=true
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Adidas\"",
        "entity_id": "string \"FCEA7CA1-1D40-4680-B337-E74594D9BCF1\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:brand\"",
        "properties": {
          "akas": [
            "{...}",
            "... 18 more"
          ],
          "image": {
            "url": "string"
          },
          "sport": "null",
          "tagline": "string \"Impossible Is Nothing\"",
          "industry": "null",
          "keywords": [
            "string \"Sport\"",
            "... 4 more"
          ],
          "owned_by": "null",
          "products": "null",
          "inception": "null",
          "lifestyle": [
            "string \"Active Living\"",
            "... 3 more"
          ],
          "brand_type": [
            "string \"Corporate Brand\""
          ],
          "industries": [
            "string \"Fashion & Apparel\"",
            "... 3 more"
          ],
          "subsidiary": "null",
          "core_values": [
            "string \"Performance\"",
            "... 3 more"
          ],
          "description": "string",
          "key_markets": [
            "string \"United States\"",
            "... 4 more"
          ],
          "founded_year": "number",
          "manufacturer": "null",
          "subsidiaries": [
            "string \"Adidas Runtastic\"",
            "... 2 more"
          ],
          "headquartered": "null",
          "official_site": "null",
          "target_gender": [
            "string \"Male\"",
            "... 2 more"
          ],
          "ticker_symbol": "null",
          "business_model": [
            "string \"B2C\"",
            "... 1 more"
          ],
          "emotional_tone": [
            "string \"Energetic\"",
            "... 3 more"
          ],
          "personal_style": [
            "string \"sporty\"",
            "... 3 more"
          ],
          "similar_brands": [
            "string \"Asics\"",
            "... 2 more"
          ],
          "ultimate_parent": "string \"Adidas AG\"",
          "immediate_parent": "string \"Adidas AG\"",
          "target_age_group": [
            "string \"Teens\"",
            "... 2 more"
          ],
          "audience_identity": "string",
          "competitor_brands": [
            "string \"Nike\"",
            "... 4 more"
          ],
          "customer_segments": [
            "string \"Competitive Athletes\"",
            "... 3 more"
          ],
          "influencer_appeal": [
            "string \"Professional Athletes\"",
            "... 4 more"
          ],
          "products_services": [
            "string \"Footwear\"",
            "... 3 more"
          ],
          "short_description": "string",
          "style_description": "string",
          "cultural_relevance": [
            "string \"Hip-Hop\"",
            "... 3 more"
          ],
          "known_partnerships": [
            "string \"Kanye West\"",
            "... 4 more"
          ],
          "market_positioning": "string",
          "...": "15 more keys"
        },
        "popularity": "number",
        "tags": [
          {
            "id": "string",
            "name": "string \"Sneakers\"",
            "type": "string \"urn:tag:genre:brand\""
          },
          "... 153 more"
        ],
        "query": {
          "affinity": "number",
          "measurements": {
            "audience_growth": "number"
          },
          "explainability": {
            "signal.interests.entities": [
              "{...}"
            ]
          }
        },
        "disambiguation": "string \"\"",
        "external": {
          "twitter": [
            "{...}",
            "... 8 more"
          ],
          "wikidata": [
            "{...}"
          ],
          "instagram": [
            "{...}",
            "... 11 more"
          ]
        }
      },
      "... 19 more"
    ]
  },
  "query": {
    "explainability": {
      "signal.interests.entities": {
        "effect_on_top3_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top5_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top10_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_all_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ]
      }
    }
  }
}
```

### /v2/insights demographics (urn:demographics)

Probe `demographics.anchor` · status 200 · 1 results · Age and gender affinity buckets for the artist audience.

```
GET /v2/insights?filter.type=urn:demographics&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3
```

```json
{
  "success": "boolean",
  "results": {
    "demographics": [
      {
        "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
        "query": {
          "age": {
            "24_and_younger": "number",
            "25_to_29": "number",
            "30_to_34": "number",
            "35_to_44": "number",
            "45_to_54": "number",
            "55_and_older": "number"
          },
          "gender": {
            "male": "number",
            "female": "number"
          }
        }
      }
    ]
  }
}
```

### /v2/insights artist -> tags

Probe `tags.anchor` · status 200 · 20 results · Artist taste profile as tags.

```
GET /v2/insights?filter.type=urn:tag&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&take=20
```

```json
{
  "success": "boolean",
  "results": {
    "tags": [
      {
        "tag_id": "string",
        "name": "string \"Moderately expensive\"",
        "types": [
          "string \"urn:entity:place\""
        ],
        "subtype": "string \"urn:tag:cost_description:place\"",
        "tag_value": "string",
        "popularity": "number",
        "query": {
          "affinity": "number"
        }
      },
      "... 19 more"
    ]
  }
}
```

### /v2/insights heatmap with heatmap.dimensions

Probe `heatmap.dimensions` · status 200 · 1227 results · Checks whether the dimensions parameter adds per-cell columns.

```
GET /v2/insights?filter.type=urn:heatmap&filter.location.query=Mexico City, Mexico&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&heatmap.dimensions=quality,popularity,price_level
```

```json
{
  "success": "boolean",
  "results": {
    "heatmap": [
      {
        "location": {
          "latitude": "number",
          "longitude": "number",
          "geohash": "string \"9g3myg\""
        },
        "query": {
          "affinity": "number",
          "affinity_rank": "number",
          "popularity": "number",
          "entity_artist_affinity_rank": "number",
          "entity_artist_affinity": "number",
          "quality_affinity_rank": "number",
          "popularity_affinity_rank": "number",
          "price_level_affinity_rank": "number",
          "price_level_total_count": "number",
          "quality_affinity": "number",
          "popularity_affinity": "number",
          "price_level_affinity": "number"
        }
      },
      "... 1226 more"
    ]
  },
  "query": {
    "localities": {
      "filter": [
        {
          "entity_id": "string \"B7114A68-EA17-4514-BE69-F67590C681D8\"",
          "name": "string \"Mexico City\"",
          "subtype": "string \"urn:entity:locality\"",
          "location": {
            "lat": "number",
            "lon": "number"
          },
          "popularity": "number",
          "disambiguation": "string \"Mexico City, Mexico\""
        }
      ]
    }
  }
}
```

### /v2/audiences/types

Probe `audiences.types` · status 200 · 10 results

```
GET /v2/audiences/types?take=50
```

```json
{
  "duration": "number",
  "success": "boolean",
  "results": {
    "audience_types": [
      {
        "parents": [
          {
            "type": "string \"urn:audience:communities\""
          }
        ],
        "type": "string \"urn:audience:communities\""
      },
      "... 9 more"
    ]
  }
}
```

### /v2/audiences (filter.parents.types=urn:audience:communities)

Probe `audiences.list` · status 200 · 4 results

```
GET /v2/audiences?filter.parents.types=urn:audience:communities&take=20
```

```json
{
  "totalRequestDuration": "number",
  "success": "boolean",
  "results": {
    "audiences": [
      {
        "entity_id": "string \"DA61B8AD-6D79-4B0C-BEA0-EC966C93902E\"",
        "name": "string \"AAPI\"",
        "parents": [
          {
            "id": "string \"urn:audience:communities\"",
            "name": "string \"Communities\"",
            "type": "string \"urn:audience\""
          }
        ],
        "type": "string \"urn:audience:communities\"",
        "id": "string \"urn:audience:communities:aapi\"",
        "disambiguation": "string \"Aapi (Communities)\"",
        "tags": [
          {
            "id": "string \"urn:tag:collection:canonical\"",
            "name": "string \"Canonical\"",
            "type": "string \"urn:tag:collection\""
          }
        ]
      },
      "... 3 more"
    ]
  }
}
```

### /entities?entity_ids=...

Probe `entities.anchor` · status 200 · 1 results · Entity details by ID (properties, external IDs, tags).

```
GET /entities?entity_ids=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3
```

```json
{
  "results": [
    {
      "name": "string \"Bad Bunny\"",
      "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
      "types": [
        "string \"urn:entity:artist\""
      ],
      "properties": {
        "akas": [],
        "duration": {},
        "external": {
          "facebook": {
            "id": "string \"badbunnyofficial\""
          },
          "instagram": {
            "id": "string \"badbunnypr\""
          },
          "lastfm": {
            "id": "string \"bad%20bunny\"",
            "listeners": "number",
            "scrobbles": "number"
          },
          "musicbrainz": {
            "id": "string \"89aa5ecb-59ad-46f5-b3eb-2d424e941f19\""
          },
          "spotify": {
            "id": "string \"4q3ewBCX7sLwd24euuV69X\""
          },
          "twitter": {
            "id": "string \"sanbenito\""
          },
          "wikidata": {
            "id": "string \"q44333953\""
          }
        },
        "image": {
          "url": "string"
        },
        "short_description": "string"
      },
      "popularity": "number",
      "tags": [
        {
          "name": "string \"Latin\"",
          "tag_id": "string \"urn:tag:genre:latin\"",
          "type": "string \"urn:tag:genre\"",
          "value": "string \"urn:tag:genre:latin\""
        },
        "... 45 more"
      ],
      "disambiguation": "string \"Bad Bunny\""
    }
  ]
}
```

### /v2/trending (artist, calendar year 2025)

Probe `trending.anchor` · status 200 · 5 results · Trend series for an entity. Path and required parameters confirmed live.

```
GET /v2/trending?signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&filter.type=urn:entity:artist&filter.start_date=2025-01-01&filter.end_date=2025-12-31&take=5
```

```json
{
  "success": "boolean",
  "results": {
    "trending": [
      {
        "date": "string \"2025-12-31\"",
        "population_percentile": "number",
        "population_rank": "string \"6885\"",
        "population_rank_velocity": "number",
        "velocity_fold_change": "number",
        "population_percent_delta": "number"
      },
      "... 4 more"
    ]
  },
  "duration": "number"
}
```

### /v2/insights heatmap, output.heatmap.boundary=urn:entity:locality

Probe `heatmap.boundary-urn-locality` · status 200 · 57 results · Heatmap aggregated by locality instead of geohash.

```
GET /v2/insights?filter.type=urn:heatmap&filter.location.query=Mexico City, Mexico&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&output.heatmap.boundary=urn:entity:locality
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"México\"",
        "entity_id": "string \"0C2901D1-FA87-4F1E-A97D-385912D6911B\"",
        "popularity": "number",
        "query": {
          "affinity": "number"
        },
        "disambiguation": "string \"México\"",
        "boundary": "string"
      },
      "... 56 more"
    ]
  },
  "query": {
    "localities": {
      "filter": [
        {
          "entity_id": "string \"B7114A68-EA17-4514-BE69-F67590C681D8\"",
          "name": "string \"Mexico City\"",
          "subtype": "string \"urn:entity:locality\"",
          "location": {
            "lat": "number",
            "lon": "number"
          },
          "popularity": "number",
          "disambiguation": "string \"Mexico City, Mexico\""
        }
      ]
    }
  }
}
```

### /v2/insights/compare artist vs. city (b.signal.location.query)

Probe `compare.artist-vs-city` · status 400 · no results array · Taste overlap between an artist audience and a city, as shared tags.

```
GET /v2/insights/compare?a.signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&b.signal.location.query=Guatemala City, Guatemala&take=10
```

```json
{
  "errors": [
    {
      "message": "string \"b.signal.interests.entities is required\"",
      "path": "string \"b.signal.interests.entities\""
    }
  ]
}
```

### /v2/insights (trends.bias)

Probe `trends.bias` · status 200 · 5 results

```
GET /v2/insights?filter.type=urn:entity:artist&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&bias.trends=high&take=5
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Tainy\"",
        "entity_id": "string \"B7E0DE43-AF9C-45A2-B721-04C762B2E995\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:artist\"",
        "properties": {
          "akas": [
            "{...}",
            "... 1 more"
          ],
          "image": {
            "url": "string"
          },
          "aliases": [
            "string \"Tainy\""
          ],
          "members": [],
          "is_group": "boolean",
          "biography": "string",
          "known_for": "string",
          "start_year": "number",
          "description": "string",
          "instruments": [
            "string \"Digital Audio Workstation\"",
            "... 2 more"
          ],
          "collaborators": [
            "string \"Bad Bunny\"",
            "... 4 more"
          ],
          "date_of_birth": "string \"1989-08-09\"",
          "influenced_by": [
            "string \"Luny Tunes\"",
            "... 2 more"
          ],
          "notable_songs": [
            "string \"Callaíta\"",
            "... 4 more"
          ],
          "lyrical_themes": [
            "string \"Love\"",
            "... 4 more"
          ],
          "place_of_birth": "string \"San Juan, Puerto Rico\"",
          "primary_genres": [
            "string \"Reggaeton\"",
            "... 1 more"
          ],
          "characteristics": [
            "string \"Innovative\"",
            "... 4 more"
          ],
          "cultural_impact": "string",
          "obscurity_scale": [
            "string \"3\""
          ],
          "secondary_genres": [
            "string \"Trap Latino\"",
            "... 2 more"
          ],
          "associated_brands": [
            "string \"Sony Music Latin\"",
            "... 1 more"
          ],
          "genres_influenced": [
            "string \"Reggaeton\"",
            "... 2 more"
          ],
          "performance_style": "string",
          "artists_influenced": [
            "string \"Bad Bunny\"",
            "... 2 more"
          ],
          "short_descriptions": [
            "{...}",
            "... 3 more"
          ],
          "adjectives_for_fans": [
            "string \"Passionate\"",
            "... 3 more"
          ],
          "adjectives_for_music": [
            "string \"Catchy\"",
            "... 4 more"
          ],
          "lyrical_themes_description": "string",
          "adjectives_for_performance_style": [
            "string \"Dynamic\"",
            "... 2 more"
          ],
          "creative_and_specific_adjectives_for_music": [
            "string \"Reggaeton\"",
            "... 4 more"
          ]
        },
        "popularity": "number",
        "tags": [
          {
            "id": "string \"urn:tag:style:qloo:electro_latin\"",
            "name": "string \"Electro Latin\"",
            "type": "string \"urn:tag:style:qloo\""
          },
          "... 48 more"
        ],
        "query": {
          "affinity": "number",
          "measurements": {
            "audience_growth": "number"
          }
        },
        "disambiguation": "string \"Tainy\"",
        "external": {
          "imdb": [
            "{...}"
          ],
          "lastfm": [
            "{...}"
          ],
          "spotify": [
            "{...}"
          ],
          "twitter": [
            "{...}",
            "... 1 more"
          ],
          "facebook": [
            "{...}"
          ],
          "wikidata": [
            "{...}"
          ],
          "instagram": [
            "{...}",
            "... 1 more"
          ],
          "musicbrainz": [
            "{...}"
          ]
        }
      },
      "... 4 more"
    ]
  }
}
```

### /v2/insights/compare (compare.v2-artist)

Probe `compare.v2-artist` · status 200 · 38 results

```
GET /v2/insights/compare?a.signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&b.signal.interests.entities=B6FA456F-B729-4700-B01F-E82AD3AC8ADA&filter.type=urn:entity:artist&take=5
```

```json
{
  "duration": "number",
  "results": {
    "tags": [
      {
        "tag_id": "string \"urn:tag:region:qloo:united_states\"",
        "name": "string \"United States\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:region:qloo\"",
        "entity_id": "string \"9231423C-49CD-4240-8227-78D285399E78\"",
        "popularity": "number",
        "query": {
          "score": "number",
          "a.signal.interests.entities": [
            "{...}"
          ],
          "b.signal.interests.entities": [
            "{...}",
            "... 1 more"
          ]
        }
      },
      "... 37 more"
    ],
    "a": [
      {
        "tag_id": "string \"urn:tag:theme:qloo:heartbreak\"",
        "name": "string \"Heartbreak\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:theme:qloo\"",
        "entity_id": "string \"1157CA05-F10E-4C89-A1B1-10DBE72F1272\"",
        "popularity": "number",
        "query": {
          "count": "string \"1\""
        }
      },
      "... 26 more"
    ],
    "b": [
      {
        "tag_id": "string \"urn:tag:music:qloo:anthemic\"",
        "name": "string \"Anthemic\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:music:qloo\"",
        "entity_id": "string \"01455406-F958-4C03-829C-5C00D58FBE47\"",
        "popularity": "number",
        "query": {
          "count": "string \"1\""
        }
      },
      "... 31 more"
    ],
    "matchEntities": []
  }
}
```

### /v2/insights/compare (compare.v2-tag)

Probe `compare.v2-tag` · status 200 · 38 results

```
GET /v2/insights/compare?a.signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&b.signal.interests.entities=B6FA456F-B729-4700-B01F-E82AD3AC8ADA&filter.type=urn:tag&take=5
```

```json
{
  "duration": "number",
  "results": {
    "tags": [
      {
        "tag_id": "string \"urn:tag:region:qloo:united_states\"",
        "name": "string \"United States\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:region:qloo\"",
        "entity_id": "string \"9231423C-49CD-4240-8227-78D285399E78\"",
        "popularity": "number",
        "query": {
          "score": "number",
          "a.signal.interests.entities": [
            "{...}"
          ],
          "b.signal.interests.entities": [
            "{...}",
            "... 1 more"
          ]
        }
      },
      "... 37 more"
    ],
    "a": [
      {
        "tag_id": "string \"urn:tag:theme:qloo:heartbreak\"",
        "name": "string \"Heartbreak\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:theme:qloo\"",
        "entity_id": "string \"1157CA05-F10E-4C89-A1B1-10DBE72F1272\"",
        "popularity": "number",
        "query": {
          "count": "string \"1\""
        }
      },
      "... 26 more"
    ],
    "b": [
      {
        "tag_id": "string \"urn:tag:music:qloo:anthemic\"",
        "name": "string \"Anthemic\"",
        "type": "string \"urn:tag\"",
        "subtype": "string \"urn:tag:music:qloo\"",
        "entity_id": "string \"01455406-F958-4C03-829C-5C00D58FBE47\"",
        "popularity": "number",
        "query": {
          "count": "string \"1\""
        }
      },
      "... 31 more"
    ],
    "matchEntities": []
  }
}
```

### /v2/insights place, filter.location=<locality id> (Guatemala City)

Probe `places.guatemala-city.by-id` · status 200 · 50 results · Places with artist signal, explainability on.

```
GET /v2/insights?filter.type=urn:entity:place&filter.location=3E843C82-ACFE-48BB-9C76-FC9A2781530D&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&take=50&feature.explainability=true
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Bazar Casa Vieja | La Pradera\"",
        "entity_id": "string \"18CF203B-E16B-4A7B-BE1F-FE6D9533B749\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:place\"",
        "properties": {
          "hours": {
            "friday": [
              "{...}"
            ],
            "monday": [
              "{...}"
            ],
            "sunday": [
              "{...}"
            ],
            "tuesday": [
              "{...}"
            ],
            "saturday": [
              "{...}"
            ],
            "thursday": [
              "{...}"
            ],
            "wednesday": [
              "{...}"
            ]
          },
          "phone": "string \"+50223673470\"",
          "images": [
            "{...}"
          ],
          "address": "string",
          "geocode": {
            "city": "string \"Guatemala City\"",
            "name": "string \"Zone 14\"",
            "metro": "null",
            "country": "string \"Guatemala\"",
            "country_code": "string \"GT\"",
            "admin1_region": "string \"Guatemala Department\"",
            "admin2_region": "string \"Guatemala City\""
          },
          "parking": "boolean",
          "website": "string \"https://m.facebook.com/bazarcasaviejagt/\"",
          "good_for": "null",
          "keywords": "null",
          "locality": {
            "city": "{...}",
            "metro": "null",
            "state": "{...}",
            "county": "{...}",
            "country": "{...}",
            "neighborhood": "{...}"
          },
          "menu_url": "null",
          "is_closed": "boolean",
          "live_music": "null",
          "localities": [
            "{...}",
            "... 4 more"
          ],
          "description": "string",
          "hotel_class": "null",
          "price_level": "null",
          "price_range": {
            "to": "null",
            "from": "null",
            "currency": "string \"usd\""
          },
          "star_rating": "null",
          "event_spaces": "boolean",
          "neighborhood": "string \"Zone 14\"",
          "pet_friendly": "null",
          "check_in_time": "null",
          "primary_genre": {
            "id": "string \"urn:tag:genre:place:home_goods_store\"",
            "akas": [
              "{...}",
              "... 55 more"
            ],
            "name": "string \"Home goods store\"",
            "type": "string \"urn:tag:genre:place\"",
            "weight": "null"
          },
          "check_out_time": "null",
          "business_rating": "number",
          "loyalty_program": "null",
          "number_of_rooms": "null",
          "cost_description": "null",
          "specialty_dishes": "null",
          "short_description": "string",
          "number_of_stations": "null",
          "cuisine_description": "null",
          "overall_description": "string",
          "service_description": "null",
          "ambience_description": "string",
          "amenities_description": "string",
          "unique_selling_points": "string",
          "neighborhood_description": "string",
          "physical_setting_description": "string",
          "...": "2 more keys"
        },
        "popularity": "number",
        "location": {
          "lat": "number",
          "lon": "number",
          "geohash": "string \"9fxduwpj1d7p\""
        },
        "tags": [
          {
            "id": "string \"urn:tag:genre:place:home_goods_store\"",
            "name": "string \"Home goods store\"",
            "type": "string \"urn:tag:genre:place\"",
            "weight": "null"
          },
          "... 54 more"
        ],
        "references": "null",
        "query": {
          "affinity": "number",
          "distance": "number",
          "measurements": {
            "audience_growth": "number"
          },
          "explainability": {
            "signal.interests.entities": [
              "{...}"
            ]
          }
        },
        "disambiguation": "string",
        "external": {
          "google_place": [
            "{...}"
          ]
        }
      },
      "... 49 more"
    ]
  },
  "query": {
    "explainability": {
      "signal.interests.entities": {
        "effect_on_top3_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top5_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_top10_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ],
        "effect_on_all_recs": [
          {
            "entity_id": "string \"BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3\"",
            "avg_score": "number"
          }
        ]
      }
    }
  }
}
```

### /v2/insights place, filter.location.query (Guatemala City)

Probe `places.guatemala-city.by-query` · status 200 · 50 results

```
GET /v2/insights?filter.type=urn:entity:place&filter.location.query=Guatemala City, Guatemala&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3&take=50
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Bazar Casa Vieja | La Pradera\"",
        "entity_id": "string \"18CF203B-E16B-4A7B-BE1F-FE6D9533B749\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:place\"",
        "properties": {
          "hours": {
            "friday": [
              "{...}"
            ],
            "monday": [
              "{...}"
            ],
            "sunday": [
              "{...}"
            ],
            "tuesday": [
              "{...}"
            ],
            "saturday": [
              "{...}"
            ],
            "thursday": [
              "{...}"
            ],
            "wednesday": [
              "{...}"
            ]
          },
          "phone": "string \"+50223673470\"",
          "images": [
            "{...}"
          ],
          "address": "string",
          "geocode": {
            "city": "string \"Guatemala City\"",
            "name": "string \"Zone 14\"",
            "metro": "null",
            "country": "string \"Guatemala\"",
            "country_code": "string \"GT\"",
            "admin1_region": "string \"Guatemala Department\"",
            "admin2_region": "string \"Guatemala City\""
          },
          "parking": "boolean",
          "website": "string \"https://m.facebook.com/bazarcasaviejagt/\"",
          "good_for": "null",
          "keywords": "null",
          "locality": {
            "city": "{...}",
            "metro": "null",
            "state": "{...}",
            "county": "{...}",
            "country": "{...}",
            "neighborhood": "{...}"
          },
          "menu_url": "null",
          "is_closed": "boolean",
          "live_music": "null",
          "localities": [
            "{...}",
            "... 4 more"
          ],
          "description": "string",
          "hotel_class": "null",
          "price_level": "null",
          "price_range": {
            "to": "null",
            "from": "null",
            "currency": "string \"usd\""
          },
          "star_rating": "null",
          "event_spaces": "boolean",
          "neighborhood": "string \"Zone 14\"",
          "pet_friendly": "null",
          "check_in_time": "null",
          "primary_genre": {
            "id": "string \"urn:tag:genre:place:home_goods_store\"",
            "akas": [
              "{...}",
              "... 55 more"
            ],
            "name": "string \"Home goods store\"",
            "type": "string \"urn:tag:genre:place\"",
            "weight": "null"
          },
          "check_out_time": "null",
          "business_rating": "number",
          "loyalty_program": "null",
          "number_of_rooms": "null",
          "cost_description": "null",
          "specialty_dishes": "null",
          "short_description": "string",
          "number_of_stations": "null",
          "cuisine_description": "null",
          "overall_description": "string",
          "service_description": "null",
          "ambience_description": "string",
          "amenities_description": "string",
          "unique_selling_points": "string",
          "neighborhood_description": "string",
          "physical_setting_description": "string",
          "...": "2 more keys"
        },
        "popularity": "number",
        "location": {
          "lat": "number",
          "lon": "number",
          "geohash": "string \"9fxduwpj1d7p\""
        },
        "tags": [
          {
            "id": "string \"urn:tag:genre:place:home_goods_store\"",
            "name": "string \"Home goods store\"",
            "type": "string \"urn:tag:genre:place\"",
            "weight": "null"
          },
          "... 54 more"
        ],
        "references": "null",
        "query": {
          "affinity": "number",
          "distance": "number",
          "measurements": {
            "audience_growth": "number"
          }
        },
        "disambiguation": "string",
        "external": {
          "google_place": [
            "{...}"
          ]
        }
      },
      "... 49 more"
    ]
  },
  "query": {
    "localities": {
      "filter": [
        {
          "entity_id": "string \"3E843C82-ACFE-48BB-9C76-FC9A2781530D\"",
          "name": "string \"Guatemala City\"",
          "subtype": "string \"urn:entity:locality\"",
          "location": {
            "lat": "number",
            "lon": "number"
          },
          "popularity": "number",
          "disambiguation": "string"
        }
      ]
    }
  }
}
```

### /v2/insights heatmap, filter.location.query (Guatemala City)

Probe `heatmap.guatemala-city.by-query` · status 200 · 855 results

```
GET /v2/insights?filter.type=urn:heatmap&filter.location.query=Guatemala City, Guatemala&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3
```

```json
{
  "success": "boolean",
  "results": {
    "heatmap": [
      {
        "location": {
          "latitude": "number",
          "longitude": "number",
          "geohash": "string \"9fxehpn\""
        },
        "query": {
          "affinity": "number",
          "affinity_rank": "number",
          "popularity": "number",
          "entity_artist_affinity_rank": "number",
          "entity_artist_affinity": "number"
        }
      },
      "... 854 more"
    ]
  },
  "query": {
    "localities": {
      "filter": [
        {
          "entity_id": "string \"3E843C82-ACFE-48BB-9C76-FC9A2781530D\"",
          "name": "string \"Guatemala City\"",
          "subtype": "string \"urn:entity:locality\"",
          "location": {
            "lat": "number",
            "lon": "number"
          },
          "popularity": "number",
          "disambiguation": "string"
        }
      ]
    }
  }
}
```

### /v2/insights heatmap, filter.location=POINT + radius (Guatemala City)

Probe `heatmap.guatemala-city.by-point` · status 200 · 545 results

```
GET /v2/insights?filter.type=urn:heatmap&filter.location=POINT(-90.5069 14.6349)&filter.location.radius=25000&signal.interests.entities=BDA1B73F-10E7-4D09-AC51-B796CCEC5FF3
```

```json
{
  "success": "boolean",
  "results": {
    "heatmap": [
      {
        "location": {
          "latitude": "number",
          "longitude": "number",
          "geohash": "string \"9fxdbu\""
        },
        "query": {
          "affinity": "number",
          "affinity_rank": "number",
          "popularity": "number",
          "entity_artist_affinity_rank": "number",
          "entity_artist_affinity": "number"
        }
      },
      "... 544 more"
    ]
  }
}
```

### /v2/insights tag, signal.location (Guatemala City)

Probe `citytags.guatemala-city` · status 200 · 20 results · City taste profile as music tags.

```
GET /v2/insights?filter.type=urn:tag&signal.location=3E843C82-ACFE-48BB-9C76-FC9A2781530D&filter.parents.types=urn:entity:artist&take=20
```

```json
{
  "success": "boolean",
  "results": {
    "tags": [
      {
        "tag_id": "string \"urn:tag:genre:music:guatemala\"",
        "name": "string \"guatemala\"",
        "types": [
          "string \"urn:entity:artist\""
        ],
        "subtype": "string \"urn:tag:genre:music\"",
        "tag_value": "string \"urn:tag:genre:music:guatemala\"",
        "popularity": "number",
        "query": {
          "affinity": "number"
        }
      },
      "... 19 more"
    ]
  }
}
```

### /v2/insights artist, signal.location (Guatemala City)

Probe `cityartists.guatemala-city` · status 200 · 20 results · Artists with affinity to the city.

```
GET /v2/insights?filter.type=urn:entity:artist&signal.location=3E843C82-ACFE-48BB-9C76-FC9A2781530D&take=20
```

```json
{
  "success": "boolean",
  "results": {
    "entities": [
      {
        "name": "string \"Gaby Moreno\"",
        "entity_id": "string \"27B180A1-3E0A-4340-81A3-57FB51816E2D\"",
        "type": "string \"urn:entity\"",
        "subtype": "string \"urn:entity:artist\"",
        "properties": {
          "image": {
            "url": "string"
          },
          "vocals": "string",
          "aliases": [
            "string \"Gabriela Moreno\""
          ],
          "members": [],
          "is_group": "boolean",
          "biography": "string",
          "known_for": "string",
          "start_year": "number",
          "description": "string",
          "instruments": [
            "string \"Guitar\"",
            "... 2 more"
          ],
          "collaborators": [
            "string \"Ricardo Arjona\"",
            "... 2 more"
          ],
          "date_of_birth": "string \"1981-12-16\"",
          "influenced_by": [
            "string \"Billie Holiday\"",
            "... 3 more"
          ],
          "notable_songs": [
            "string \"Fuiste Tú\"",
            "... 3 more"
          ],
          "lyrical_themes": [
            "string \"Love\"",
            "... 4 more"
          ],
          "place_of_birth": "string \"Guatemala City, Guatemala, Guate\"",
          "primary_genres": [
            "string \"Blues\"",
            "... 3 more"
          ],
          "characteristics": [
            "string \"Emotive\"",
            "... 4 more"
          ],
          "cultural_impact": "string",
          "obscurity_scale": [
            "string \"4\""
          ],
          "secondary_genres": [
            "string \"Jazz\"",
            "... 2 more"
          ],
          "associated_brands": [],
          "genres_influenced": [
            "string \"Latin Blues\"",
            "... 2 more"
          ],
          "performance_style": "string",
          "artists_influenced": [
            "string \"Ximena Sariñana\"",
            "... 2 more"
          ],
          "short_descriptions": [
            "{...}",
            "... 3 more"
          ],
          "adjectives_for_fans": [
            "string \"Loyal\"",
            "... 3 more"
          ],
          "adjectives_for_music": [
            "string \"Soulful\"",
            "... 4 more"
          ],
          "lyrical_themes_description": "string",
          "adjectives_for_performance_style": [
            "string \"Intimate\"",
            "... 3 more"
          ],
          "creative_and_specific_adjectives_for_music": [
            "string \"Latin Blues\"",
            "... 4 more"
          ]
        },
        "popularity": "number",
        "tags": [
          {
            "id": "string \"urn:tag:audience:qloo:loyal\"",
            "name": "string \"Loyal\"",
            "type": "string \"urn:tag:audience:qloo\""
          },
          "... 49 more"
        ],
        "query": {
          "affinity": "number",
          "measurements": {
            "audience_growth": "number"
          }
        },
        "disambiguation": "string \"Gaby Moreno\"",
        "external": {
          "imdb": [
            "{...}"
          ],
          "lastfm": [
            "{...}"
          ],
          "spotify": [
            "{...}"
          ],
          "facebook": [
            "{...}"
          ],
          "wikidata": [
            "{...}"
          ],
          "instagram": [
            "{...}"
          ],
          "musicbrainz": [
            "{...}"
          ]
        }
      },
      "... 19 more"
    ]
  }
}
```

## 7. Open questions

- 3 of 45 artist queries did not resolve to a matching top result: Frigüey, Shaka y Dres, Dimensión Costeña.

## 8. Analyst notes

These notes interpret the generated sections above. They are hand-written and
survive re-runs of the probe (the script inlines this file).

### Headline: coverage is sufficient in all six Latin American markets

Every market returns at least 50 places with an artist signal, 50 places
without any signal, 50 bars and hotels (except Panama's and Managua's bars at
42 and 46), hundreds of heatmap cells, 20 location-biased brands, 20 city
artists and 20 city tags. Regional artists resolve (3/5 to 5/5) and each one
tested has an affinity graph (10 similar artists with explainability). The
Miami control does not stand apart on any count. The demo-market choice is
therefore not constrained by Qloo coverage; it is a story choice.

Recommendation for the three demo markets, in order:

1. **Guatemala City.** Home market, 5/5 regional artists, the city-artist list
   is genuinely local (Gaby Moreno, Ricardo Arjona at the top), 855 heatmap
   cells, 50 bars and hotels, 24% of places carry a price level.
2. **Santo Domingo.** The strongest local-genre identity in the probe (city
   tags: dembow, merengue; city artists: El Alfa, Don Miguelo, Mozart la Para),
   5/5 artists, 451 cells. A good "the agent knows this scene" demonstration.
3. **Mexico City.** The large-market comparator and the only Latin market with
   real venue inventory in Qloo (38 night clubs, 15 concert halls, 9 stadiums),
   6,436 heatmap cells with the locality id. Shows the product scales up.

Alternatives: **Panama City** works after the locality fix (city artists:
Rubén Blades, Erika Ender, Los Rabanes; tags: salsa, Latin jazz) and keeps the
pitch inside Central America if Mexico City is dropped. **Managua** is fine
(4/5 artists, 249 cells, tags: reggaeton, latin pop). **San Salvador** is the
weakest: 3/5 artists, 184 cells, and its city-artist list is generic
(Residente, Ricky Martin, Britney Spears), so the "local taste" story is thin.

### Traps found, and what the product must do about them

- **"Panama City" means Florida.** Every spelling of "Panama City" in
  `/search` and in `filter.location.query` resolves to Panama City Beach or
  Panama City, Bay County, Florida. The capital is the locality **Distrito
  Panamá** (`B41D2DC7-98B6-46CE-B5DF-7F455F3CC105`). Rule for the product:
  resolve localities through `/search?types=urn:entity:locality` with
  "city, country", check the country in `disambiguation`, let the user confirm
  the candidate on the map, persist the entity id, and pass **only the entity
  id** (`filter.location` / `signal.location`) to insights. Free text never
  reaches `/v2/insights` from the app.
- **San Salvador** resolves first to the department (Departamento de San
  Salvador), the municipality is the second candidate. Both work; the
  department is the metro area and is acceptable, but the picker should show
  both.
- **Two "Mexico City" entities.** `/search` returns `6A479AAF-…` (Ciudad de
  México, 6,436 heatmap cells); `filter.location.query` resolves to
  `B7114A68-…` (Mexico City, 1,066 cells). Different extents, same name. Store
  the id and show the extent.
- **Miami** resolves first to Miami-Dade (county); exact-name preference picks
  the city. Same rule as above.
- **Invalid parameters are silently ignored** (confirmed: an invented
  `filter.bogus_parameter` returns identical results with status 200), and
  valid parameters on the wrong entity type are ignored too
  (`filter.location.query` and `filter.price_level.min` on artists,
  `filter.location.query` on brands: identical results). The client must
  whitelist parameters per entity type and refuse to send anything else.

### Verified behavior to build on (M1 client and tools)

- **Auth and limits.** Header `X-Api-Key`; hackathon base URL only (production
  base answers 401 "Invalid API Key"). Rate limits are published in response
  headers: **10 requests/second, 50,000 requests/month**. Three probe runs
  used about 700. At roughly 40 calls per brief the monthly budget covers more
  than a thousand briefs; caching makes this moot in practice.
- **Error shapes.** v2 400s: `{"errors":[{"message","path"}]}`. 401:
  `{"error":{"reason","message","code"}}`. 404 on unknown paths: a plain
  message. Zod union with a fallback.
- **`/search`.** `types` must be a full URN (`urn:entity:artist`); the 400
  message lists every accepted value, including `urn:entity:locality`,
  `urn:entity:album`, `urn:entity:actor`, `urn:entity:videogame` (no
  underscore), `urn:demographics` and `urn:tag`. `filter.type` is also
  accepted. Without `types`, Bad Bunny came back as `urn:entity:person`, so
  always pass `types`.
- **Entity results** carry `name`, `entity_id`, `subtype`, `popularity`
  (0–1), `tags[]`, `properties` (rich: for artists biography, genres, notable
  songs, place of birth, lyrical themes, characteristics; for brands
  industries, target age group, cultural relevance, known partnerships,
  competitor brands, key markets; for places address, business rating, price
  level, hours, live music, event spaces, good-for, neighborhood, images),
  `external` (Spotify, MusicBrainz, Instagram, Wikidata, Last.fm listeners;
  Google place id for places) and `query.affinity`.
- **Explainability.** With `feature.explainability=true` each entity gets
  `query.explainability["signal.interests.entities"]: [{entity_id, score}]`.
  With one signal the score is trivially 1. To obtain meaningful weights the
  agent must pass several signals at once (artist plus locality plus
  demographics), which is how lineup and sponsor explanations should be
  produced.
- **Locality as a signal.** `signal.location=<locality entity id>` works for
  artist, brand and tag insights in all seven markets (no fallback was
  needed). `signal.location.query` also works but inherits the free-text
  trap. Location changes brand rankings substantially (Jaccard to the global
  list between 0.05 and 0.82), which is the basis of the sponsor section.
- **Heatmap.** Requires `filter.location` (locality id or WKT `POINT` plus
  `filter.location.radius`) or `filter.location.query`; `signal.location` is
  rejected with a 400. Cells: `location{latitude, longitude, geohash}`
  (precision 6–7) and `query{affinity, affinity_rank, popularity,
  entity_artist_affinity, entity_artist_affinity_rank}`.
  `heatmap.dimensions=quality,popularity,price_level` works and adds
  `quality_affinity`, `popularity_affinity`, `price_level_affinity`,
  `price_level_total_count` and their ranks per cell. This is the pricing
  proxy to use: place-level `price_level` is populated on only 2–34% of
  places. `output.heatmap.boundary` accepts `urn:geohash` (default) or
  `urn:entity:locality`; the latter returns localities (neighbourhoods) with
  affinity and a boundary string, useful for a neighbourhood table next to
  the map.
- **Demographics.** `filter.type=urn:demographics` returns one object per
  signal entity with `query.age` (`24_and_younger`, `25_to_29`, `30_to_34`,
  `35_to_44`, `45_to_54`, `55_and_older`) and `query.gender` (`male`,
  `female`). Values are affinity scores, not audience shares, and can be
  negative. Label them as affinities.
- **Trending.** `/v2/trending` exists and requires `signal.interests.entities`,
  `filter.type`, `filter.start_date` and `filter.end_date`. It returns a daily
  series `{date, population_percentile, population_rank,
  population_rank_velocity, velocity_fold_change, population_percent_delta}`.
  Calendar year 2025 has data; August–October 2026 returned an empty series,
  so the data lags the present. Brands returned nothing. Use the trailing
  twelve months, show the latest available point and velocity, artists only.
  `bias.trends=high` on `/v2/insights` works as a ranking bias.
- **Compare.** `/v2/insights/compare` needs `a.` and `b.`
  `signal.interests.entities` (a location signal on one side is rejected). It
  returns shared tags with a score plus the tags unique to `a` and to `b`.
  Use it for co-headliner fit. For artist-versus-city taste match, compute
  the overlap between artist tags (`filter.type=urn:tag` with the artist
  signal) and city tags (`filter.type=urn:tag` with `signal.location`).
- **Not available on this host.** `/analysis`, `/v2/analysis`,
  `/analysis/compare`, `/v2/trends/*` and `/trends/*` all return 404.
- **Audiences.** `/v2/audiences/types` lists 10 types;
  `/v2/audiences?filter.parents.types=<type>` lists audiences with ids such
  as `urn:audience:communities:aapi`, usable in
  `signal.demographics.audiences`.
- **Venue inventory is thin in Central America.** With the locality id,
  concert halls return 0–1, stadiums 0–3 and night clubs 0–3 in every market
  except Mexico City (15 / 9 / 38) and Miami (3 / 2 / 28). Bars, hotels and
  restaurants are plentiful everywhere. Product implication: the venue
  shortlist comes from the promoter's form in these markets, labeled "no
  coverage" when Qloo returns fewer than three venue-tagged places; Qloo
  places power the partners section (pre-parties, hospitality, bundles).
  Additional venue tags exist and should be measured when the places tool
  is built: `urn:tag:category:place:event_venue`,
  `urn:tag:genre:place:live_music_venue`,
  `urn:tag:category:place:performing_arts_theater`,
  `urn:tag:category:place:arena`.
- **Paging.** `take` caps at 50 on insights; `page=2` returns a disjoint set.

### Where the API disagrees with the docs or the kickoff brief

- Heatmaps take the area as a **filter** (`filter.location`), not as a
  signal; the brief said "with a location signal".
- `output.heatmap.boundary` values are `urn:geohash` and
  `urn:entity:locality`, not `geohash` and `locality`.
- `/search` accepts the same URNs as `filter.type`; the brief expected them to
  differ. The accepted list spells video games `urn:entity:videogame`.
- `filter.type` also accepts `urn:demographics` and `urn:tag`, which the
  brief's list omitted; both are load-bearing for this product.
- The trends and analysis endpoints named in the brief do not exist here;
  `/v2/trending` and `/v2/insights/compare` are the live equivalents.

### Open questions for David (M0)

1. **Demo markets.** Recommendation above: Guatemala City, Santo Domingo,
   Mexico City. Swap Mexico City for Panama City if the pitch should stay
   within Central America and the Caribbean.
2. **GCP project and models.** The service account belongs to project
   `n1-data`. Claude 4.5 and 4.6 models answer in both `global` and
   `us-east5`; the Claude 5.x models (`claude-opus-5-5`, `claude-haiku-5-5`,
   `claude-sonnet-5-5`) are listed in Model Garden but return 404 "your
   project does not have access" until they are enabled through the Model
   Garden questionnaire for that project. Decide: enable 5.5 in `n1-data`, or
   build M1 on `claude-opus-4-6` (planner) and `claude-haiku-4-5`
   (classification). Model ids will be environment variables either way.

## Markets added 2026-10-30

Probe through `/search` (types=urn:entity:locality, take 6), then `/v2/insights` heatmap with `filter.location=<id>` and the anchor signal (Bad Bunny), `urn:entity:artist` with `signal.location=<id>` (take 10) and `urn:tag` music genres with the same signal. Picked candidate = first result whose disambiguation names the expected country.

| Market | Locality id | Disambiguation | Heatmap cells | Top city artists (affinity 1.00) | Music tags |
|---|---|---|---|---|---|
| São Paulo | 87DE0F46-8AF7-449B-8369-CC2296578282 | São Paulo, Região Imediata de São Paulo, São Paulo, Região Sudeste, Brasil | 1224 | Criolo, Caetano Veloso, Liniker, Fábio Porchat, Gloria Groove, Pitty, Madonna, Rita Lee, Elza Soares, Gilberto Gil | tropicalia, brazilian rock, '80s, classic rock, heavy metal, queer, freestyle |
| Buenos Aires | AC7D5EB0-92E9-4EF6-8243-81AA6853143E | Buenos Aires, Comuna 6, Ciudad Autónoma de Buenos Aires, Argentina | 3886 | Dante Spinetta, Emmanuel Horvilleur, Madonna, Mick Jagger, Deborah de Corral, Natalie Perez, Ricky Martin, Marilina Bertoldi, LOUTA, Miss Bolivia | Rock Argentino, Rock en Espanol, '80s, blues, classic rock, guitar, Dance-Pop |
| New York City | 81E61924-6CEE-4AB4-93D3-282A5C784AB8 | New York, New York, United States of America | 1356 | Solange, Lizzo, Rihanna, Naomi Campbell, Pharrell Williams, Nicole Richie, Madonna, Janelle Monáe, Billy Porter, Beyoncé | Broadway, cabaret, Musical theatre, Disco, avant-garde, chillwave, queer |
| Los Angeles | 10F17338-97FE-40A3-9434-F6D59F000A9E | Los Angeles, California, United States of America | 4405 | Nicole Richie, Pharrell Williams, Solange, Gwen Stefani, Lizzo, Dita Von Teese, Diplo, Felipe Esparza | chillwave, post-punk, Disco, new wave, trip-hop, instrumental hip hop, cabaret, psychedelic |
| Tampa | CF0B5657-4CBE-4B3F-9476-57644B5C87A1 | Tampa, Hillsborough, Florida, United States of America | 754 | Plies, Lizzo, Jessie James Decker, Britney Spears, Jessica Simpson, Rick Ross, Julianne Hough, T.I. | contemporary country, American Idol, praise and worship, Brostep, Acoustic Rock, Country-Pop |

Traps seen: "São Paulo" also returns São Paulo in Lisbon and smaller Brazilian localities; "Buenos Aires" returns neighbourhoods in Medellín and Santiago (DO) and a canton in Costa Rica; "Los Angeles" returns Los Ángeles in Chile, Spain, Colombia and Costa Rica; "Tampa" returns Tampa, Kansas. The disambiguation shown in the picker is what tells them apart. `/search` locality results carry no `geocode` block, so the country code is read from the disambiguation text.
