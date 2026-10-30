# Decision log

One line per decision, newest last. Dates are absolute (YYYY-MM-DD).

- 2026-10-30 Repo, package and UI name is `gigcast` (David's instruction; replaces the `soundcheck` codename from the kickoff brief).
- 2026-10-30 TypeScript end to end, no Python: one deployable that serves SSE and the UI from the same process; a second stack would not get to a complete product faster.
- 2026-10-30 SvelteKit 2 pinned by scaffolding with `sv@0.15.1`; the current `sv` CLI generates SvelteKit 3, which the brief did not ask for.
- 2026-10-30 Tailwind 4, `@sveltejs/adapter-node`, pnpm 12, Node >= 22 (development on Node 26; `scripts/*.ts` run on Node's native type stripping, so the probe has zero dependencies).
- 2026-10-30 Charts: ECharts. Maps: MapLibre GL JS with geohash cells decoded by `ngeohash`.
- 2026-10-30 Postgres via Docker Compose locally; the hosted provider is decided at M2 (default leaning Neon).
- 2026-10-30 Git: the first scaffold commit landed on `main` directly (nothing to open a PR against); everything after goes through squash-merged pull requests.
- 2026-10-30 Secrets live in a gitignored local env file; `GOOGLE_APPLICATION_CREDENTIALS` points at a gitignored `_secrets/` folder inside the checkout (also excluded by `.dockerignore`). Only names go in `.env.example`.
- 2026-10-30 Model split for the build itself: Fable orchestrates; Sonnet subagents handle scaffolding and boilerplate. Product models (planner and classifier) are environment variables, see the Vertex finding below.
- 2026-10-30 Vertex: project `n1-data` answers for Claude 4.5/4.6 in `global` and `us-east5`; Claude 5.x models are listed but not enabled for the project. M1 defaults to `claude-opus-4-6` (planner) and `claude-haiku-4-5` (classification) unless David enables 5.5; region default `global`.
- 2026-10-30 Qloo probe caches every raw response in `.cache/qloo-probe/` and replays from it with `QLOO_PROBE_REPLAY=1`; the same cache-first pattern becomes the client's replay mode in M1.
- 2026-10-30 Localities are resolved through `/search?types=urn:entity:locality` with "city, country", verified against the country in `disambiguation`, confirmed by the user on the map, and persisted as entity ids; free text never reaches `/v2/insights` (the "Panama City" query resolves to Florida).
- 2026-10-30 The Qloo client whitelists parameters per entity type because the API silently ignores invalid or misplaced ones (confirmed live).
- 2026-10-30 Pricing guidance uses heatmap `price_level_affinity` per cell (`heatmap.dimensions`) rather than place `price_level`, which is populated on only 2–34% of places.
- 2026-10-30 Venue section: when Qloo returns fewer than three venue-tagged places for a market, it is labeled "no coverage" and the promoter's venue shortlist is used; Qloo places power the partners section instead.
- 2026-10-30 Explainability is requested with several simultaneous signals (artist, locality, demographics) because a single signal always scores 1.
- 2026-10-30 Trends come from `/v2/trending` over the trailing twelve months (the series lags the present), artists only; `bias.trends` is used as a ranking bias for lineup candidates. The `/v2/trends/*` and `/analysis` paths from the brief do not exist on the hackathon host.
- 2026-10-30 Artist-versus-city taste match is computed from tag overlap (artist tags vs. `signal.location` tags); `/v2/insights/compare` is entity-versus-entity only and is used for co-headliner fit.
- 2026-10-30 Demo markets proposed: Guatemala City, Santo Domingo, Mexico City (Panama City as the Central America-only alternative). Awaiting David's pick.
