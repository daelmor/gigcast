# Status

Last updated: 2026-10-30 (end of M2).

## Milestone: M2 Web — done, deployment pending David's Google Cloud access

### What works

- Web flow end to end: `/new` (featured markets as quick picks, locality search with the country check and fallback queries, artist autocomplete through Qloo `/search`, date window, optional promoter numbers) → `POST /api/briefs` → `/brief/:id` with the live agent trace and a per-section progress strip over SSE → the finished document rendered in place, without a reload. Briefs are public read-only links; each one also has `/brief/:id/markdown` and `/api/briefs/:id` (JSON).
- The document: header with verdict and run status, key points, audience map on MapLibre (heatmap layer from the attached cells, dimension toggle for affinity / popularity / quality / price level, hotspots and venue markers with popups, neighbourhood bars), demand and fit (popularity, trend sparkline, demographics bars, taste match), lineup with Qloo explainability, sponsors with collapsed outreach drafts, venues and partners by kind, pricing tiers, the no-coverage risk panel, open questions, method (run summary and verification downgrades) and the numbered sources that resolve each `[S#]` to the Qloo request. Labels grounded / inferred / no coverage on every item, legend in the footer, works at 375 px.
- Persistence in Postgres: `briefs`, `brief_runs` and `agent_events` are written as the run happens; the SSE endpoint replays persisted events after `Last-Event-ID`, follows the in-process hub for local runs and polls the database for runs on another instance. Orphaned runs are marked failed on restart; known markets are upserted on start.
- Live web run through the real path (Juan Luis Guerra, Santo Domingo, `claude-opus-4-6` at effort high, started from `POST /api/briefs`, followed over SSE, persisted and rendered): status complete, 24 tool calls, 24 Qloo calls (first time for this market, so no cache hits), 0 of 16 grounded picks downgraded, 512 heatmap cells with dimensions, 15 neighbourhoods, 50 trend points, lineup and sponsors all grounded with Dominican brands (Brugal, Cervecería Nacional Dominicana, Claro). It took 667 s because the model's first `emit_brief` was rejected by the draft schema (headline and key points over the length caps) and it had to recompose; the caps are now wider, the tool description states the expected lengths, and such rejections appear in the trace as warnings instead of a silent gap.
- Production build and container: `pnpm build` (adapter-node) and the Docker image run with `MIGRATE_ON_START=true`; the container smoke test against the local database passed (health, home, create brief, SSE `done`, brief page). Image 442 MB.
- Quality gates: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm test` 181 unit tests, `pnpm test:e2e` 4 Playwright tests (happy path from `/new` to the finished document, reload of a finished brief, API validation and 404) all pass.
- Deployment is scripted: `deploy/cloud-run.sh` plus `docs/deploy.md` (APIs, Artifact Registry, runtime service account, secrets, Cloud Build, Cloud Run flags, verification, operations).

### Deployed

Nothing yet. Two things only David can do, see "Blocked" below.

### Blocked

1. **Google Cloud permissions.** The service account the assistant uses (`claude-code-reviewer@n1-data`) has Vertex AI permissions only; `testIamPermissions` returned none of Cloud Run, Artifact Registry, Cloud Build, Secret Manager, Cloud SQL or IAM. Either run `./deploy/cloud-run.sh` yourself after `gcloud auth login` (recommended, about ten minutes), or grant that service account the roles listed in `docs/deploy.md` and the assistant deploys.
2. **Postgres provider.** Recommendation: Neon free tier (serverless, TLS, no VPC); alternatives in `docs/deploy.md`. Whichever it is, the connection string goes into the `gigcast-database-url` secret.

### Decisions taken without blocking (see docs/decisions.md)

- Demo markets per David: Guatemala City, Santo Domingo, Mexico City; Panama City as the Central America-only swap. All probed markets are quick picks; any Qloo locality works through the search.
- Planner stays on `claude-opus-4-6` per David; Claude 5.5 is an env-var switch once enabled in the project.
- One Cloud Run instance with CPU always allocated, two concurrent briefs per instance, migrations on start, OpenFreeMap tiles, a fake agent runner for end-to-end tests, confirmed entity ids passed to the agent as hints.

### Next (M3 Counterfactual and drafts)

- The counterfactual run: the same question with the Qloo tools removed, asked only for lineup and sponsors, in parallel with the main run; the two-column "LLM only vs. grounded in Qloo" panel with explainability weights.
- Sponsor outreach drafts as a first-class view (the drafts already exist in the brief), places and pricing views, print stylesheet for PDF export.
- Persist and show the counterfactual run in `brief_runs` and the trace.

### Known limitations

- A brief takes 4 to 6 minutes at effort high; the page streams progress so the wait is visible, and the link keeps working if the tab is closed. `--effort medium` on the CLI is the speed lever; the web run uses high.
- The event hub is per process: with more than one Cloud Run instance a viewer connected to the other instance gets updates every 2 s from the database instead of instantly. `--max-instances 1` avoids it for the demo.
- Qloo venue inventory is thin in Central America; the venues section leans on the promoter's own venue and on bars, restaurants and hotels near the heat.
- The risk panel is `no_coverage` until M4; the landing's "example brief" and demo mode arrive in M5.
- The dev-only `/dev/preview` route renders the sample brief and trace and returns 404 in production.

### Environment notes

- Local: Node 26, pnpm 12, Docker (`gigcast-db-1` Postgres 16 on 5432), Playwright browsers installed, `gh` authenticated as `daelmor`, Google Cloud SDK installed but not authenticated (the app uses Application Default Credentials from the service-account path in the local env file).
- New optional variables since M1: `MAX_CONCURRENT_RUNS`, `AGENT_RUNNER`, `MIGRATE_ON_START`; `FAKE_RUNNER_STEP_MS` slows the canned trace for tests and screenshots. `.env.example` lists names only.
- End-to-end tests write briefs into the local database (`AGENT_RUNNER=fake`, Qloo cache in `.cache/qloo-e2e`).
