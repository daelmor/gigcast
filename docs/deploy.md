# Deploying gigcast to Cloud Run

One container (SvelteKit with adapter-node) on Cloud Run in the same Google Cloud project as Claude on Vertex AI (`n1-data`), with a hosted Postgres database. The script `deploy/cloud-run.sh` does every Google Cloud step; this page explains what it needs and why.

## Who can run it

The deploy needs a human with `gcloud auth login` as an owner or editor of the project. The service account the assistant works with (`claude-code-reviewer@n1-data`) only has Vertex AI permissions, so it cannot create the Cloud Run service, the Artifact Registry repository, the secrets or the runtime service account. Roles the deploying account uses: Cloud Run Admin, Artifact Registry Admin, Cloud Build Editor, Secret Manager Admin, Service Account Admin and Service Account User, Service Usage Admin.

## 1. Postgres

Cloud Run does not host databases. Pick one of:

- **Neon** (recommended for the hackathon): free tier, serverless, reachable over TLS without a VPC. Create a project, copy the pooled connection string and append `?sslmode=require` if it is not already there. Drizzle migrations run at server start through the same URL.
- **Supabase**: use the *session* pooler connection string (port 5432) so prepared statements work; the transaction pooler needs `prepare: false` in postgres.js, which the app does not set.
- **Cloud SQL**: enable `sqladmin.googleapis.com`, create a Postgres 16 instance, a database and a user, then deploy with `--add-cloudsql-instances PROJECT:REGION:INSTANCE` and a URL of the form `postgres://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE`. The runtime service account also needs `roles/cloudsql.client`. Costs money from the first hour.

Whatever the choice, the value goes into Secret Manager, never into the repo or a shell history line with the value in clear:

```sh
printf '%s' "$DATABASE_URL" | gcloud secrets create gigcast-database-url --data-file=- --project n1-data
```

## 2. Secrets

Two secrets, created once (read from stdin so the values do not appear in the command):

```sh
printf '%s' "$QLOO_API_KEY" | gcloud secrets create gigcast-qloo-api-key --data-file=- --project n1-data
printf '%s' "$DATABASE_URL" | gcloud secrets create gigcast-database-url --data-file=- --project n1-data
```

Rotate with `gcloud secrets versions add <name> --data-file=-`; Cloud Run picks up `latest` on the next deploy or revision.

## 3. Deploy

```sh
./deploy/cloud-run.sh
```

What it does, in order: enables the APIs (Run, Artifact Registry, Cloud Build, Secret Manager, Vertex AI), creates the Docker repository `gigcast`, creates the runtime service account `gigcast-run` with `roles/aiplatform.user`, grants it `secretAccessor` on both secrets, builds the image with Cloud Build from the repo (`.gcloudignore` keeps secrets and caches out of the upload), deploys the service and finally sets `ORIGIN` and `APP_BASE_URL` to the service URL.

Service settings and why:

| Setting | Value | Reason |
| --- | --- | --- |
| `--max-instances` | 1 | The live event hub is per process; the Postgres fallback keeps a second instance correct but the demo does not need one. |
| `--no-cpu-throttling` | on | A brief run continues after `POST /api/briefs` returns; without this the CPU is throttled between requests. |
| `--timeout` | 900 s | The SSE connection stays open for the whole run (about five minutes). |
| `--concurrency` | 20 | Plenty for a demo; runs are capped separately by `MAX_CONCURRENT_RUNS=2`. |
| `--memory` / `--cpu` | 1 GiB / 1 | The agent loop is I/O bound; the heatmap payloads are the largest objects. |
| `MIGRATE_ON_START=true` | env | Drizzle migrations apply when the container starts; the `drizzle/` folder ships in the image. |
| `--allow-unauthenticated` | on | Judges open the demo without a Google account. Briefs are public read-only links by design. |

Environment variables set by the script: `GOOGLE_CLOUD_PROJECT`, `ANTHROPIC_VERTEX_REGION=global`, `QLOO_BASE_URL`, `QLOO_MODE=live`, `QLOO_CACHE_BACKEND=postgres`, `MIGRATE_ON_START=true`, `MAX_CONCURRENT_RUNS=2`, `LOG_LEVEL=info`, `NODE_ENV=production`, plus `ORIGIN` and `APP_BASE_URL` after the first deploy. Secrets mounted as env: `QLOO_API_KEY`, `DATABASE_URL`. Authentication to Vertex uses the attached service account; no JSON key is involved.

Overrides: `PROJECT`, `REGION` (default `us-central1`), `SERVICE`, `REPO`, `SA_NAME`, `MAX_INSTANCES`.

## 4. Verify

```sh
URL=$(gcloud run services describe gigcast --region us-central1 --format 'value(status.url)')
curl -fsS "$URL/api/health"
```

Then open `$URL/new`, pick Guatemala City and Ricardo Arjona, and watch the trace. The first brief in a fresh database makes every Qloo call live (about 25 calls); the second one for the same inputs is mostly cache hits.

## Operations

- Logs: `gcloud run services logs read gigcast --region us-central1 --limit 100`. Every line is JSON with a `requestId`; agent runs log `brief started`, `brief run finished` and `brief persisted` with the brief id.
- Redeploy: rerun the script; the image tag is the git short SHA.
- Rollback: `gcloud run services update-traffic gigcast --region us-central1 --to-revisions <revision>=100`.
- Costs: with `--no-cpu-throttling` and `--min-instances 0` you pay for instance time while a request or a run is active and nothing when idle. Keep `--max-instances 1` unless the Qloo monthly quota (50,000 calls) and the Vertex budget are raised.
- Switching models: set `CLAUDE_PLANNER_MODEL` on the service once Claude 5.5 is enabled in the project's Model Garden.

## Local Docker check

The same image runs locally against the Docker Compose database:

```sh
docker build -t gigcast:local .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://gigcast:gigcast@host.docker.internal:5432/gigcast \
  -e MIGRATE_ON_START=true -e ORIGIN=http://localhost:3000 \
  -e QLOO_API_KEY=... -e GOOGLE_CLOUD_PROJECT=n1-data \
  -e GOOGLE_APPLICATION_CREDENTIALS=/run/sa.json -v /path/outside/repo/sa.json:/run/sa.json:ro \
  gigcast:local
```

With `-e AGENT_RUNNER=fake` the container serves the canned trace and the sample brief, which is how the M2 smoke test was run without any secret.
