# Status

Last updated: 2026-10-30 (end of M1).

## Milestone: M1 Core — done

### What works

- `pnpm brief --city "Guatemala City" --country GT --artist "Ricardo Arjona" --from 2026-11-20 --to 2026-11-22` builds a complete Booking Brief from the terminal: the agent trace streams to stderr, the Markdown prints to stdout, and `.cache/briefs/<id>.{json,events.json,md}` hold the brief, the events and the document. Two live runs on `claude-opus-4-6` at effort high: 25 and 24 tool calls, 21 and 24 Qloo calls (13 served from the Postgres cache on the second run), 0 of 16 and 0 of 18 grounded picks downgraded, 4.5 and 5.2 minutes (most of it the model composing the draft).
- Typed Qloo client (`src/lib/server/qloo/`): per-entity-type parameter whitelist (the API silently ignores bad parameters), Postgres cache keyed by the normalized request with a file store for offline work and tests, `live` / `replay` / `refresh` modes, 8 req/s throttle under the published 10 req/s limit, retries on 429/5xx, Zod schemas derived from the recorded samples, validation before caching. Locality resolver with the country check that defeats the "Panama City is in Florida" trap.
- Agent (`src/lib/server/agent/`): twelve Qloo tools plus `emit_brief` on the SDK tool runner (streaming, eager tool-input streaming, adaptive thinking, explicit effort, frozen cached system prompt, tool budget 36, iteration cap 40, fail-soft partial briefs). Every tool records its Qloo requests and returned entity ids; the server attaches the raw artifacts (heatmap cells, neighbourhoods, demographics, trend series, candidate lists) and verifies every `grounded` pick against the entities Qloo really returned, downgrading the rest to `inferred`.
- Brief contract (`src/lib/brief/schema.ts`): draft, artifacts, resolution, verification and run summary; labels grounded / inferred / no_coverage on every item; agent events for SSE. Markdown renderer with `[S#]` source markers that resolve to the Qloo request behind each claim.
- Database: nine Drizzle tables with the initial migration applied locally (`pnpm db:start`, `pnpm db:migrate`). The Qloo cache already lives in Postgres; briefs, runs and events are persisted from M2 on.
- Quality gates: `pnpm check`, `pnpm lint`, `pnpm test` (159 tests: params whitelist, schemas against all 24 recorded samples, client caching and retries, locality resolution, tools and registry, assembly and verification, prompt, renderer, brief schema) all pass.

### Deployed

Nothing yet. First deployment is the goal of M2.

### Decisions taken without blocking (see docs/decisions.md)

- Planner model `claude-opus-4-6`, classifier `claude-haiku-4-5`, region `global`, all overridable by environment variables, because Claude 5.x is not yet enabled for project `n1-data` on Vertex.
- The risk layer (news, holidays, climate, advisories) is M4; briefs label the risk panel `no_coverage` until then.

### Still open for David

1. Demo markets (recommendation unchanged: Guatemala City, Santo Domingo, Mexico City; Panama City as the Central America-only swap).
2. Whether to enable Claude 5.5 in `n1-data` (Model Garden questionnaire) or stay on 4.6 / 4.5 for the submission.

### Next (M2 Web)

- `/new` form (market picker with map and locality confirmation, artist autocomplete through `/search`, date window, promoter inputs) and `POST /api/briefs` that starts a run.
- `/brief/:id` with the live SSE trace, then the full document: heatmap on MapLibre from the attached cells, lineup and sponsors with explainability, labels and sources everywhere, print stylesheet.
- Persist briefs, runs and events in Postgres; public read-only brief links.
- Deploy the Docker image to Cloud Run in `n1-data`; Cloud Run service account instead of the JSON key.

### Known limitations

- Run time of 4 to 5 minutes per brief at effort high; `--effort medium` is the lever if the demo needs speed. M2 streams progress so the wait is visible.
- `/v2/trending` returns at most 50 sparse points per call and ignores paging; the tool uses the trailing twelve months.
- Venue inventory in Qloo is thin in Central America (0 concert halls, 3 stadiums in Guatemala City); venues come from the promoter's form when Qloo returns fewer than three.
- Counterfactual "LLM only vs. grounded" panel, sponsor drafts in the UI, places and pricing views arrive in M3.

### Environment notes

- Local tooling: Node 26, pnpm 12, Docker running (`gigcast-db-1` Postgres 16 on 5432), `gh` authenticated as `daelmor`, Google Cloud SDK installed via Homebrew but not authenticated (the app uses Application Default Credentials from the service-account path in the local env file; a session guard prevents the assistant from touching credential files).
- Secrets: the gitignored local env file holds `QLOO_API_KEY`, `QLOO_BASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT=n1-data`, `ANTHROPIC_VERTEX_REGION=global`, `DATABASE_URL`. `.env.example` lists names only; new optional variables: `QLOO_MODE`, `QLOO_CACHE_BACKEND`, `QLOO_CACHE_DIR`, `CLAUDE_PLANNER_MODEL`, `CLAUDE_CLASSIFIER_MODEL`.
