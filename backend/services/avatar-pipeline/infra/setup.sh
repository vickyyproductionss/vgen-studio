#!/bin/bash
# ============================================================
# GCP Avatar Pipeline - Infrastructure Setup Script
# Project: flowsocial-498207
# Region: asia-south1 (Mumbai)
# Run this ONCE to provision all GCP resources.
# ============================================================

set -euo pipefail

PROJECT_ID="flowsocial-498207"
REGION="asia-south1"
ZONE="asia-south1-a"
BUCKET_NAME="vgen-avatar-pipeline"
TOPIC_NAME="avatar-jobs"
SUBSCRIPTION_NAME="avatar-worker-sub"
API_SERVICE_NAME="avatar-api"
WORKER_VM_NAME="avatar-gpu-worker"
WORKER_SA_NAME="avatar-worker-sa"
API_SA_NAME="avatar-api-sa"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/avatar-pipeline"

echo "=================================================="
echo " Avatar Pipeline GCP Setup"
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo "=================================================="

# ── 0. Set project ─────────────────────────────────────────────────────────────
gcloud config set project "${PROJECT_ID}"

# ── 1. Enable required APIs ────────────────────────────────────────────────────
echo ""
echo "→ Enabling GCP APIs..."
gcloud services enable \
  storage.googleapis.com \
  pubsub.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --quiet

echo "✓ APIs enabled"

# Create Artifact Registry repo if it doesn't exist
echo "→ Creating Artifact Registry repository..."
gcloud artifacts repositories create avatar-pipeline \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --quiet 2>/dev/null || echo "✓ Repository already exists"

# ── 2. Cloud Storage bucket ────────────────────────────────────────────────────
echo ""
echo "→ Creating GCS bucket: gs://${BUCKET_NAME}"
if ! gsutil ls "gs://${BUCKET_NAME}" &>/dev/null; then
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BUCKET_NAME}"
  echo "✓ Bucket created"
else
  echo "✓ Bucket already exists"
fi

# Create folder structure (GCS uses prefixes, create placeholder objects)
echo "→ Creating bucket folder structure..."
for prefix in uploads/avatars/ uploads/audio/ outputs/videos/ temporary/jobs/; do
  echo "" | gsutil cp - "gs://${BUCKET_NAME}/${prefix}.keep" 2>/dev/null || true
done
echo "✓ Folder structure created"

# Set CORS for browser uploads
cat > /tmp/cors.json << 'EOF'
[{
  "origin": ["*"],
  "method": ["GET", "PUT", "POST", "DELETE"],
  "responseHeader": ["Content-Type", "Authorization"],
  "maxAgeSeconds": 3600
}]
EOF
gsutil cors set /tmp/cors.json "gs://${BUCKET_NAME}"
echo "✓ CORS configured"

# Grant access to Cloud Build / Compute service accounts on our bucket
echo "→ Configuring bucket IAM permissions for Cloud Build..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
gsutil iam ch "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com:roles/storage.objectAdmin" "gs://${BUCKET_NAME}" || true
gsutil iam ch "serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com:roles/storage.objectAdmin" "gs://${BUCKET_NAME}" || true
echo "✓ Bucket IAM permissions configured"

# ── 3. Pub/Sub topic + subscription ───────────────────────────────────────────
echo ""
echo "→ Creating Pub/Sub topic: ${TOPIC_NAME}"
gcloud pubsub topics create "${TOPIC_NAME}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "✓ Topic already exists"

echo "→ Creating Pub/Sub subscription: ${SUBSCRIPTION_NAME}"
gcloud pubsub subscriptions create "${SUBSCRIPTION_NAME}" \
  --topic="${TOPIC_NAME}" \
  --project="${PROJECT_ID}" \
  --ack-deadline=600 \
  --message-retention-duration=7d \
  --expiration-period=never \
  2>/dev/null || echo "✓ Subscription already exists"
echo "✓ Pub/Sub configured"

# ── 4. Service Accounts ────────────────────────────────────────────────────────
echo ""
echo "→ Using existing service account: vgenai@${PROJECT_ID}.iam.gserviceaccount.com"
API_SA="vgenai@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SA="vgenai@${PROJECT_ID}.iam.gserviceaccount.com"
echo "✓ Service accounts configured (using existing SA to bypass IAM policy limitations)"

# ── 5. Build + Push API Docker image ──────────────────────────────────────────
echo ""
echo "→ Building Cloud Run API image..."
API_IMAGE="${REGISTRY}/avatar-api:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${SCRIPT_DIR}/../api"

gcloud builds submit --tag "${API_IMAGE}" --gcs-source-staging-dir="gs://${BUCKET_NAME}/temporary/cloudbuild" "${API_DIR}"
echo "✓ API image pushed via Cloud Build: ${API_IMAGE}"

# ── 6. Deploy Cloud Run API ────────────────────────────────────────────────────
echo ""
echo "→ Deploying Cloud Run service: ${API_SERVICE_NAME}"
gcloud run deploy "${API_SERVICE_NAME}" \
  --image="${API_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --service-account="${API_SA}" \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${BUCKET_NAME},PUBSUB_TOPIC=${TOPIC_NAME}" \
  --quiet

API_URL=$(gcloud run services describe "${API_SERVICE_NAME}" \
  --platform=managed --region="${REGION}" \
  --format="value(status.url)")
echo "✓ Cloud Run deployed: ${API_URL}"

# ── 7. Build + Push Worker Docker image ───────────────────────────────────────
echo ""
echo "→ Building Worker Docker image (this may take 10-20 min — large CUDA base)..."
WORKER_IMAGE="${REGISTRY}/avatar-worker:latest"
WORKER_DIR="${SCRIPT_DIR}/../worker"

gcloud builds submit --tag "${WORKER_IMAGE}" --gcs-source-staging-dir="gs://${BUCKET_NAME}/temporary/cloudbuild" "${WORKER_DIR}" --timeout="2h"
echo "✓ Worker image pushed via Cloud Build: ${WORKER_IMAGE}"

# ── 8. Create GPU VM ───────────────────────────────────────────────────────────
echo ""
echo "→ Creating GPU VM: ${WORKER_VM_NAME}"

STARTUP_SCRIPT="${SCRIPT_DIR}/startup-script.sh"
sed "s|__PROJECT_ID__|${PROJECT_ID}|g;s|__BUCKET_NAME__|${BUCKET_NAME}|g;s|__SUBSCRIPTION__|${SUBSCRIPTION_NAME}|g;s|__WORKER_IMAGE__|${WORKER_IMAGE}|g" \
  "${STARTUP_SCRIPT}" > /tmp/startup-rendered.sh

gcloud compute instances create "${WORKER_VM_NAME}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --machine-type="g2-standard-8" \
  --accelerator="type=nvidia-l4,count=1" \
  --maintenance-policy=TERMINATE \
  --restart-on-failure \
  --image-family="ubuntu-2204-lts" \
  --image-project="ubuntu-os-cloud" \
  --boot-disk-size="100GB" \
  --boot-disk-type="pd-ssd" \
  --service-account="${WORKER_SA}" \
  --scopes="cloud-platform" \
  --metadata-from-file="startup-script=/tmp/startup-rendered.sh" \
  --tags="avatar-worker" 2>/dev/null || echo "✓ VM already exists"

echo "✓ GPU VM created: ${WORKER_VM_NAME}"

# ── 9. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " ✅ Setup Complete!"
echo "=================================================="
echo ""
echo "  Cloud Run API:   ${API_URL}"
echo "  GCS Bucket:      gs://${BUCKET_NAME}"
echo "  Pub/Sub Topic:   ${TOPIC_NAME}"
echo "  Subscription:    ${SUBSCRIPTION_NAME}"
echo "  GPU Worker VM:   ${WORKER_VM_NAME} (${ZONE})"
echo ""
echo "  Environment variable to add to your .env:"
echo "  AVATAR_API_URL=${API_URL}"
echo ""
echo "  Test the API:"
echo "  curl ${API_URL}/health"
echo ""
