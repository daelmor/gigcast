#!/usr/bin/env bash
# Deploy gigcast to Azure Container Apps.
#
# Run by a human (or an agent) with `az login` done in the target subscription. Reads the
# secrets from the environment and never prints them:
#
#   QLOO_API_KEY                    Qloo hackathon key
#   DATABASE_URL                    Neon connection string (pooled, with sslmode=require)
#   GOOGLE_APPLICATION_CREDENTIALS  path to the GCP service-account JSON (Claude on Vertex AI)
#   GOOGLE_CLOUD_PROJECT            GCP project that hosts Claude on Vertex AI
#
# Typical use: load the local env file into the shell, then run this script.
#
# Resources (all in one resource group): Azure Container Registry (Basic), a Container Apps
# environment with its Log Analytics workspace, and the container app with external ingress.
# The GCP credentials and the two secrets are stored as Container Apps secrets; the JSON is
# mounted as a file so the Google SDK reads it through GOOGLE_APPLICATION_CREDENTIALS.
#
# Overrides: RG, LOCATION, APP, ENV_NAME, ACR, MIN_REPLICAS, MAX_REPLICAS, JOB_NAME, INGEST_CRON, INGEST_JOB_SECRET,
# PUBLIC_ORIGIN, AUTH_MODE, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_ALLOWED_EMAILS, BRIEFS_PER_USER_PER_DAY.
set -euo pipefail

RG="${RG:-rg-gigcast}"
LOCATION="${LOCATION:-eastus}"
APP="${APP:-gigcast}"
ENV_NAME="${ENV_NAME:-cae-gigcast}"
MIN_REPLICAS="${MIN_REPLICAS:-1}"
MAX_REPLICAS="${MAX_REPLICAS:-1}"

# Shared secret for POST /api/jobs/ingest. Reused from the running app when not given, generated
# on the very first deploy; the job and the app always get the same value.
INGEST_JOB_SECRET="${INGEST_JOB_SECRET:-}"
JOB_NAME="${JOB_NAME:-gigcast-ingest}"
INGEST_CRON="${INGEST_CRON:-0 */6 * * *}"

# Sign-in for creating briefs (docs/auth.md): off, or required with a Google OAuth client.
AUTH_MODE="${AUTH_MODE:-off}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
AUTH_ALLOWED_EMAILS="${AUTH_ALLOWED_EMAILS:-}"
BRIEFS_PER_USER_PER_DAY="${BRIEFS_PER_USER_PER_DAY:-10}"
if [ "${AUTH_MODE}" = "required" ] && { [ -z "${GOOGLE_CLIENT_ID}" ] || [ -z "${GOOGLE_CLIENT_SECRET}" ]; }; then
  echo "AUTH_MODE=required needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" >&2
  exit 1
fi

: "${QLOO_API_KEY:?QLOO_API_KEY is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GOOGLE_APPLICATION_CREDENTIALS:?GOOGLE_APPLICATION_CREDENTIALS (path) is required}"
: "${GOOGLE_CLOUD_PROJECT:?GOOGLE_CLOUD_PROJECT is required}"
[ -r "$GOOGLE_APPLICATION_CREDENTIALS" ] || { echo "cannot read $GOOGLE_APPLICATION_CREDENTIALS" >&2; exit 1; }

SUB_ID="$(az account show --query id -o tsv)"
if [ -z "${INGEST_JOB_SECRET}" ]; then
  INGEST_JOB_SECRET="$(az containerapp secret show -n "${APP}" -g "${RG}" --secret-name ingest-job-secret --query value -o tsv 2>/dev/null || true)"
fi
INGEST_JOB_SECRET="${INGEST_JOB_SECRET:-$(openssl rand -hex 24)}"
SUB_NAME="$(az account show --query name -o tsv)"
# Registry names are global and alphanumeric; derive a stable one from the subscription.
ACR="${ACR:-gigcast$(printf '%s' "$SUB_ID" | tr -d '-' | cut -c1-10)}"
TAG="$(git rev-parse --short HEAD)"
IMAGE="${ACR}.azurecr.io/gigcast:${TAG}"

say() { printf '\n==> %s\n' "$*"; }

say "Subscription ${SUB_NAME}, resource group ${RG} in ${LOCATION}, app ${APP}, image ${IMAGE}"
az config set extension.use_dynamic_install=yes_without_prompt -o none 2>/dev/null || true

say "Resource group"
az group create -n "${RG}" -l "${LOCATION}" -o none

say "Container registry ${ACR}"
az acr show -n "${ACR}" -g "${RG}" -o none 2>/dev/null ||
  az acr create -n "${ACR}" -g "${RG}" --sku Basic -o none

say "Building the image in the registry (linux/amd64, context filtered by .dockerignore)"
az acr build -r "${ACR}" -g "${RG}" -t "gigcast:${TAG}" -t "gigcast:latest" --platform linux/amd64 . >/dev/null

say "Container Apps environment ${ENV_NAME}"
az containerapp env show -n "${ENV_NAME}" -g "${RG}" -o none 2>/dev/null ||
  az containerapp env create -n "${ENV_NAME}" -g "${RG}" -l "${LOCATION}" -o none

SA_JSON="$(cat "${GOOGLE_APPLICATION_CREDENTIALS}")"
ENV_VARS=(
  "GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}"
  "ANTHROPIC_VERTEX_REGION=global"
  "GOOGLE_APPLICATION_CREDENTIALS=/mnt/secrets/gcp-sa-json"
  "QLOO_BASE_URL=https://hackathon.api.qloo.com"
  "QLOO_MODE=live"
  "QLOO_CACHE_BACKEND=postgres"
  "MIGRATE_ON_START=true"
  "MAX_CONCURRENT_RUNS=2"
  "LOG_LEVEL=info"
  "NODE_ENV=production"
  "PORT=3000"
  "HOST=0.0.0.0"
  "SHUTDOWN_TIMEOUT=600"
  "QLOO_API_KEY=secretref:qloo-api-key"
  "DATABASE_URL=secretref:database-url"
  "INGEST_JOB_SECRET=secretref:ingest-job-secret"
  "AUTH_MODE=${AUTH_MODE}"
  "BRIEFS_PER_USER_PER_DAY=${BRIEFS_PER_USER_PER_DAY}"
)
SECRETS=(
  "qloo-api-key=${QLOO_API_KEY}"
  "database-url=${DATABASE_URL}"
  "gcp-sa-json=${SA_JSON}"
  "ingest-job-secret=${INGEST_JOB_SECRET}"
)
if [ -n "${GOOGLE_CLIENT_ID}" ] && [ -n "${GOOGLE_CLIENT_SECRET}" ]; then
  ENV_VARS+=("GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" "GOOGLE_CLIENT_SECRET=secretref:google-client-secret")
  SECRETS+=("google-client-secret=${GOOGLE_CLIENT_SECRET}")
fi
if [ -n "${AUTH_ALLOWED_EMAILS}" ]; then
  ENV_VARS+=("AUTH_ALLOWED_EMAILS=${AUTH_ALLOWED_EMAILS}")
fi

if az containerapp show -n "${APP}" -g "${RG}" -o none 2>/dev/null; then
  say "Updating secrets and the running app"
  az containerapp secret set -n "${APP}" -g "${RG}" -o none \
    --secrets "${SECRETS[@]}"
  az containerapp registry set -n "${APP}" -g "${RG}" --server "${ACR}.azurecr.io" --identity system -o none
  az containerapp update -n "${APP}" -g "${RG}" -o none \
    --image "${IMAGE}" \
    --min-replicas "${MIN_REPLICAS}" --max-replicas "${MAX_REPLICAS}" \
    --termination-grace-period 600 \
    --set-env-vars "${ENV_VARS[@]}"
else
  say "Creating the app"
  # One replica: the live SSE hub is per process (the Postgres fallback keeps a second replica
  # correct). min 1 keeps the agent loop alive after the HTTP request that started it returned.
  # The 600 s grace period (with SHUTDOWN_TIMEOUT=600 in the app) lets briefs in flight finish
  # and persist when a new revision replaces the replica.
  az containerapp create -n "${APP}" -g "${RG}" -o none \
    --environment "${ENV_NAME}" \
    --image "${IMAGE}" \
    --registry-server "${ACR}.azurecr.io" --registry-identity system --system-assigned \
    --target-port 3000 --ingress external --transport auto \
    --min-replicas "${MIN_REPLICAS}" --max-replicas "${MAX_REPLICAS}" \
    --termination-grace-period 600 \
    --cpu 1.0 --memory 2.0Gi \
    --secrets "${SECRETS[@]}" \
    --secret-volume-mount /mnt/secrets \
    --env-vars "${ENV_VARS[@]}"
fi

FQDN="$(az containerapp show -n "${APP}" -g "${RG}" --query properties.configuration.ingress.fqdn -o tsv)"
# The public address. The custom domain is bound to the app (A record for the apex, CNAME for
# www, asuid TXT records in Route 53); the app redirects every other host there, except /api.
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://gigcast.ai}"
say "Setting ORIGIN to ${PUBLIC_ORIGIN}"
az containerapp update -n "${APP}" -g "${RG}" -o none \
  --set-env-vars "ORIGIN=${PUBLIC_ORIGIN}" "APP_BASE_URL=${PUBLIC_ORIGIN}"

say "Scheduled ingestion job ${JOB_NAME} (${INGEST_CRON})"
# A tiny curl container posts to the ingest endpoint on a cron. The spec goes through a YAML file
# because the CLI cannot take "-c" and "curl -X ..." as argument values; the file holds the secret,
# so it is created with owner-only permissions and removed right after.
ENV_ID="$(az containerapp env show -n "${ENV_NAME}" -g "${RG}" --query id -o tsv)"
JOB_SPEC="$(mktemp)"
chmod 600 "${JOB_SPEC}"
cat > "${JOB_SPEC}" <<YAML
location: ${LOCATION}
name: ${JOB_NAME}
properties:
  environmentId: ${ENV_ID}
  configuration:
    triggerType: Schedule
    replicaTimeout: 600
    replicaRetryLimit: 1
    scheduleTriggerConfig:
      cronExpression: "${INGEST_CRON}"
      parallelism: 1
      replicaCompletionCount: 1
    secrets:
      - name: ingest-job-secret
        value: "${INGEST_JOB_SECRET}"
  template:
    containers:
      - name: ingest
        image: curlimages/curl:8.11.1
        command: ["/bin/sh", "-c"]
        args: ["curl -fsS -m 290 -X POST -H \"Authorization: Bearer \$INGEST_JOB_SECRET\" https://${FQDN}/api/jobs/ingest"]
        env:
          - name: INGEST_JOB_SECRET
            secretRef: ingest-job-secret
        resources:
          cpu: 0.25
          memory: 0.5Gi
YAML
# `job update --yaml` does not accept the full spec, so an existing job is recreated.
if az containerapp job show -n "${JOB_NAME}" -g "${RG}" -o none 2>/dev/null; then
  az containerapp job delete -n "${JOB_NAME}" -g "${RG}" --yes -o none
fi
az containerapp job create -n "${JOB_NAME}" -g "${RG}" --yaml "${JOB_SPEC}" -o none
rm -f "${JOB_SPEC}"

say "Waiting for the new revision"
for _ in $(seq 1 30); do
  if curl -fsS -m 10 "https://${FQDN}/api/health" >/dev/null 2>&1; then break; fi
  sleep 10
done
curl -fsS -m 10 "https://${FQDN}/api/health" && echo
say "Done: ${PUBLIC_ORIGIN} (platform hostname https://${FQDN})"
