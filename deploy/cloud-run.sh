#!/usr/bin/env bash
# Deploy gigcast to Cloud Run in the Vertex AI project.
#
# Run this yourself with gcloud authenticated as a project owner or editor
# (`gcloud auth login`). It never prints secret values. Before the first run,
# create the two secrets from your shell (values are read from stdin):
#
#   printf '%s' "$QLOO_API_KEY"  | gcloud secrets create gigcast-qloo-api-key  --data-file=- --project n1-data
#   printf '%s' "$DATABASE_URL"  | gcloud secrets create gigcast-database-url  --data-file=- --project n1-data
#
# Later rotations: `printf '%s' "$VALUE" | gcloud secrets versions add <name> --data-file=-`.
#
# Environment overrides: PROJECT, REGION, SERVICE, REPO, SA_NAME, MAX_INSTANCES.
set -euo pipefail

PROJECT="${PROJECT:-n1-data}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-gigcast}"
REPO="${REPO:-gigcast}"
SA_NAME="${SA_NAME:-gigcast-run}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
TAG="$(git rev-parse --short HEAD)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:${TAG}"

say() { printf '\n==> %s\n' "$*"; }

say "Project ${PROJECT}, region ${REGION}, service ${SERVICE}, image ${IMAGE}"
gcloud config set project "${PROJECT}" >/dev/null

say "Enabling APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com

say "Artifact Registry repository"
gcloud artifacts repositories describe "${REPO}" --location "${REGION}" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "${REPO}" --repository-format docker --location "${REGION}" \
    --description "gigcast images"

say "Runtime service account ${SA}"
gcloud iam service-accounts describe "${SA}" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "${SA_NAME}" --display-name "gigcast Cloud Run runtime"
gcloud projects add-iam-policy-binding "${PROJECT}" --member "serviceAccount:${SA}" \
  --role roles/aiplatform.user --condition=None >/dev/null

say "Secret access"
for secret in gigcast-qloo-api-key gigcast-database-url; do
  gcloud secrets describe "${secret}" >/dev/null 2>&1 || {
    echo "Secret ${secret} does not exist. Create it first (see the header of this script)." >&2
    exit 1
  }
  gcloud secrets add-iam-policy-binding "${secret}" --member "serviceAccount:${SA}" \
    --role roles/secretmanager.secretAccessor >/dev/null
done

say "Building the image with Cloud Build"
gcloud builds submit --tag "${IMAGE}" .

say "Deploying"
# --no-cpu-throttling keeps the agent loop running between SSE chunks; --timeout covers a 5-minute brief.
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SA}" \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi --cpu 1 \
  --timeout 900 \
  --concurrency 20 \
  --min-instances 0 --max-instances "${MAX_INSTANCES}" \
  --no-cpu-throttling \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT},ANTHROPIC_VERTEX_REGION=global,QLOO_BASE_URL=https://hackathon.api.qloo.com,QLOO_MODE=live,QLOO_CACHE_BACKEND=postgres,MIGRATE_ON_START=true,MAX_CONCURRENT_RUNS=2,LOG_LEVEL=info,NODE_ENV=production" \
  --set-secrets "QLOO_API_KEY=gigcast-qloo-api-key:latest,DATABASE_URL=gigcast-database-url:latest"

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --format 'value(status.url)')"
say "Setting ORIGIN to ${URL}"
gcloud run services update "${SERVICE}" --region "${REGION}" \
  --update-env-vars "ORIGIN=${URL},APP_BASE_URL=${URL}" >/dev/null

say "Done: ${URL}"
curl -fsS "${URL}/api/health" && echo
