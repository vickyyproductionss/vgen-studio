#!/bin/bash
# Local installation script for Google Cloud CLI (gcloud) on Apple Silicon macOS.
# Downloads and extracts the SDK directly into the project directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SDK_DIR="${PROJECT_ROOT}/google-cloud-sdk"
TAR_FILE="${PROJECT_ROOT}/google-cloud-cli-darwin-arm.tar.gz"

echo "=================================================="
echo " Installing Google Cloud CLI locally"
echo " Target directory: ${SDK_DIR}"
echo "=================================================="

# Create target directory if it doesn't exist
mkdir -p "${PROJECT_ROOT}"

# Download if not already downloaded
if [ ! -f "${TAR_FILE}" ] && [ ! -d "${SDK_DIR}" ]; then
  echo "→ Downloading Google Cloud CLI archive..."
  curl -L -o "${TAR_FILE}" "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz"
  echo "✓ Download complete"
else
  echo "✓ Archive already downloaded or SDK already extracted"
fi

# Extract if not already extracted
if [ ! -d "${SDK_DIR}" ]; then
  echo "→ Extracting archive..."
  tar -xf "${TAR_FILE}" -C "${PROJECT_ROOT}"
  echo "✓ Extraction complete"
  # Clean up tar file
  rm -f "${TAR_FILE}"
else
  echo "✓ SDK directory already exists"
fi

# Verify installation
GCLOUD_BIN="${SDK_DIR}/bin/gcloud"
if [ -f "${GCLOUD_BIN}" ]; then
  echo "→ Verifying gcloud version..."
  "${GCLOUD_BIN}" --version
  echo "=================================================="
  echo " ✅ Google Cloud CLI is ready to use!"
  echo " Path: ${GCLOUD_BIN}"
  echo "=================================================="
else
  echo "❌ Error: gcloud binary not found at ${GCLOUD_BIN}"
  exit 1
fi
