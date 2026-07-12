#!/bin/bash
# Exit immediately if any command fails
set -e

# Configuration
REGION="us-central1"
REPO_NAME="video-automation"
IMAGE_NAME="orchestrator"
SERVICE_NAME="video-automation-service"
PROJECT_ID="video-automation-studio-78216"

echo "=================================================="
echo "🚀 STARTING GCP DEPLOYMENT FOR VIDEO GENERATOR"
echo "📌 Project ID: $PROJECT_ID"
echo "📌 Region:     $REGION"
echo "=================================================="

# 1. Set current gcloud project context
echo "⚙️ Setting gcloud project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# 2. Enable necessary APIs
echo "🔑 Enabling GCP APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  texttospeech.googleapis.com \
  aiplatform.googleapis.com

# 3. Create Artifact Registry Repository if it doesn't exist
echo "📦 Checking Artifact Registry repository '$REPO_NAME'..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
  echo "Creating Artifact Registry repository '$REPO_NAME' in '$REGION'..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Video Automation Studio"
else
  echo "✅ Repository '$REPO_NAME' already exists."
fi

# Define container image tag
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$IMAGE_NAME:latest"

# 4. Build and push image using Google Cloud Build
echo "🛠️ Building container image via Google Cloud Build..."
gcloud builds submit --tag "$IMAGE_TAG" .

# 5. Create Cloud Storage bucket if it doesn't exist
BUCKET_NAME="${PROJECT_ID}-video-automation-renders"
echo "🪣 Checking Cloud Storage bucket gs://$BUCKET_NAME..."
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" &>/dev/null; then
  echo "Creating bucket gs://$BUCKET_NAME..."
  gcloud storage buckets create "gs://$BUCKET_NAME" --location="$REGION"
else
  echo "✅ Bucket gs://$BUCKET_NAME already exists."
fi

# 6. Deploy the container to Cloud Run
# Load local .env if it exists to get ElevenLabs keys
ENV_VARS="GCS_BUCKET_NAME=$BUCKET_NAME,GCP_PROJECT_ID=$PROJECT_ID"
if [ -f backend/.env ]; then
  echo "📖 Loading API keys from backend/.env..."
  ELEVENLABS_KEY=$(grep -E "^ELEVENLABS_API_KEY=" backend/.env | cut -d'=' -f2-)
  
  if [ -n "$ELEVENLABS_KEY" ]; then
    ENV_VARS="$ENV_VARS,ELEVENLABS_API_KEY=$ELEVENLABS_KEY"
  fi
fi

# We allocate 8GiB memory and 4 vCPUs since Remotion launches Chromium headlessly to render video frames.
echo "🚢 Deploying service to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$REGION" \
  --platform managed \
  --memory 8Gi \
  --cpu 4 \
  --timeout 900 \
  --concurrency 1 \
  --max-instances 3 \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --set-env-vars="$ENV_VARS"

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo "=================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "🌐 Cloud Run Service URL: $SERVICE_URL"
echo "=================================================="
