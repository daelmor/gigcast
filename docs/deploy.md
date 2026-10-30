# Deploying gigcast

One container (SvelteKit with adapter-node), a hosted Postgres on Neon, and Claude on Vertex AI in Google Cloud project `n1-data`. The app runs on **Azure Container Apps** (David's call, 2026-10-30); the Google Cloud Run path is kept below as the alternative.

## Azure Container Apps (current)

### Who can run it

Anyone with `az login` in the target subscription (`Fegora`) and rights to create a resource group. The script creates everything else. The Google side needs nothing new: the app authenticates to Vertex AI with the existing service-account JSON, mounted as a secret file.

### 1. Postgres on Neon

The Neon project `gigcast` (branch `production`, database `neondb`) was created by David; `neon init` pulled `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into the local env file. The app uses the pooled URL; postgres.js and the Drizzle migrator both work through Neon's pooler, and `pnpm db:migrate` against it succeeded before the first deploy. The connection string carries `sslmode=require`.

### 2. Deploy

Load the local env file into the shell (it holds `QLOO_API_KEY`, `DATABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT`), then:

```sh
./deploy/azure-container-apps.sh
```

What it does, in order: resource group `rg-gigcast` in `eastus`; an Azure Container Registry (Basic, name derived from the subscription id); `az acr build` of the Dockerfile for linux/amd64 in the registry (the upload honours `.dockerignore`, so secrets and caches never leave the machine); a Container Apps environment `cae-gigcast` with its Log Analytics workspace; the container app `gigcast` with a system-assigned identity that pulls from the registry; the secrets `qloo-api-key`, `database-url` and `gcp-sa-json`, the last one mounted as the file `/mnt/secrets/gcp-sa-json` and pointed to by `GOOGLE_APPLICATION_CREDENTIALS`; finally `ORIGIN` and `APP_BASE_URL` set to the app's FQDN. Rerunning the script rebuilds the image with the current git SHA, refreshes the secrets and rolls a new revision.

Settings and why:

| Setting | Value | Reason |
| --- | --- | --- |
| Replicas | min 1, max 1 | The live SSE hub is per process and a brief run continues after the request that started it returned; one warm replica keeps both simple. The Postgres fallback keeps a second replica correct if the maximum is raised. |
| CPU / memory | 1 vCPU / 2 GiB | The agent loop is I/O bound; heatmap payloads are the largest objects. |
| Ingress | external, HTTPS, port 3000 | Judges open the demo without an account. Briefs are public read-only links by design. |
| `MIGRATE_ON_START=true` | env | Drizzle migrations apply when the container starts; the `drizzle/` folder ships in the image. |
| `MAX_CONCURRENT_RUNS=2` | env | Protects the Qloo monthly quota and the Vertex budget; extra requests get 429. |

Environment set by the script: `GOOGLE_CLOUD_PROJECT`, `ANTHROPIC_VERTEX_REGION=global`, `GOOGLE_APPLICATION_CREDENTIALS=/mnt/secrets/gcp-sa-json`, `QLOO_BASE_URL`, `QLOO_MODE=live`, `QLOO_CACHE_BACKEND=postgres`, `MIGRATE_ON_START=true`, `MAX_CONCURRENT_RUNS=2`, `LOG_LEVEL=info`, `NODE_ENV=production`, `PORT=3000`, `HOST=0.0.0.0`, plus `ORIGIN` and `APP_BASE_URL`. Secrets as env: `QLOO_API_KEY`, `DATABASE_URL`.

Overrides: `RG`, `LOCATION`, `APP`, `ENV_NAME`, `ACR`, `MIN_REPLICAS`, `MAX_REPLICAS`.

### 3. Verify

```sh
FQDN=$(az containerapp show -n gigcast -g rg-gigcast --query properties.configuration.ingress.fqdn -o tsv)
curl -fsS "https://$FQDN/api/health"
```

Open `https://$FQDN/new`, pick a market and an artist, and watch the trace. The first brief for a market makes every Qloo call live; the second for the same inputs is mostly cache hits.

### Operations

- Logs: `az containerapp logs show -n gigcast -g rg-gigcast --follow` (console) or query the Log Analytics workspace. Every line is JSON with a `requestId`; runs log `brief started`, `brief run finished` and `brief persisted` with the brief id.
- Rotate a secret: `az containerapp secret set -n gigcast -g rg-gigcast --secrets qloo-api-key=...` then `az containerapp revision restart` (or redeploy).
- Rollback: `az containerapp revision list` and `az containerapp ingress traffic set --revision-weight <revision>=100`.
- Ingress closes idle or very long HTTP requests after about four minutes; the SSE client reconnects with `Last-Event-ID` and the server replays, so a ten-minute brief still streams.
- Costs: Consumption plan, one always-on replica of 1 vCPU / 2 GiB. Set `MIN_REPLICAS=0` to scale to zero between demos, at the cost of a cold start and of runs dying if the only viewer closes the tab.
- Switching models: set `CLAUDE_PLANNER_MODEL` on the app (`az containerapp update --set-env-vars`) once Claude 5.5 is enabled in `n1-data`.

### Tear down

```sh
az group delete -n rg-gigcast --yes --no-wait
```

## Google Cloud Run (alternative)

Kept for the record; not used.

### Who can run it

A human with `gcloud auth login` as an owner or editor of the project. The service account the assistant works with (`claude-code-reviewer@n1-data`) only has Vertex AI permissions, so it cannot create the Cloud Run service, the Artifact Registry repository, the secrets or the runtime service account. Roles the deploying account uses: Cloud Run Admin, Artifact Registry Admin, Cloud Build Editor, Secret Manager Admin, Service Account Admin and Service Account User, Service Usage Admin.

### Postgres

Neon works unchanged (TLS, no VPC). Alternatives: Supabase with the *session* pooler (port 5432); Cloud SQL with `--add-cloudsql-instances PROJECT:REGION:INSTANCE`, a URL of the form `postgres://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE` and `roles/cloudsql.client` on the runtime service account.

### Secrets and deploy

```sh
printf '%s' "$QLOO_API_KEY" | gcloud secrets create gigcast-qloo-api-key --data-file=- --project n1-data
printf '%s' "$DATABASE_URL" | gcloud secrets create gigcast-database-url --data-file=- --project n1-data
./deploy/cloud-run.sh
```

The script enables the APIs, creates the Docker repository and the runtime service account `gigcast-run` (`roles/aiplatform.user`, `secretAccessor` on both secrets), builds with Cloud Build, deploys with `--max-instances 1 --no-cpu-throttling --timeout 900 --concurrency 20 --memory 1Gi` and `MIGRATE_ON_START=true`, and sets `ORIGIN` to the service URL. On Cloud Run the attached service account authenticates to Vertex AI; no JSON key is involved.

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
