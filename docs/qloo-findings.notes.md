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
