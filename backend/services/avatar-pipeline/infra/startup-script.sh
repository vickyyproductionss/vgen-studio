#!/bin/bash
# VM Startup Script - Runs on every boot of the GPU worker VM
# Installs NVIDIA drivers, Docker, pulls worker image, starts systemd service
# Placeholders: __PROJECT_ID__, __BUCKET_NAME__, __SUBSCRIPTION__, __WORKER_IMAGE__
# These are replaced by setup.sh using sed before passing to gcloud.

set -e
exec > /var/log/startup-script.log 2>&1
echo "[$(date)] Startup script running..."

# ── 1. Install Docker if missing ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[$(date)] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ── 2. Install NVIDIA Container Toolkit ──────────────────────────────────────
if ! dpkg -s nvidia-container-toolkit &>/dev/null; then
  echo "[$(date)] Installing NVIDIA Container Toolkit..."
  distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
  curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | apt-key add -
  curl -s -L "https://nvidia.github.io/libnvidia-container/${distribution}/libnvidia-container.list" \
    | tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update -y
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
  echo "[$(date)] NVIDIA Container Toolkit installed"
fi

# ── 3. Install NVIDIA GPU Driver (if not present) ─────────────────────────────
if ! command -v nvidia-smi &>/dev/null; then
  echo "[$(date)] Installing NVIDIA GPU drivers..."
  apt-get install -y ubuntu-drivers-common
  ubuntu-drivers install
  echo "[$(date)] GPU drivers installed (reboot may be needed)"
fi

# ── 4. Authenticate Docker with GCR ──────────────────────────────────────────
gcloud auth configure-docker asia-south1-docker.pkg.dev --quiet

# ── 5. Pull latest worker image ───────────────────────────────────────────────
echo "[$(date)] Pulling worker image: __WORKER_IMAGE__"
docker pull __WORKER_IMAGE__ || echo "WARNING: Docker pull failed, using cached image"

# ── 6. Create systemd service ─────────────────────────────────────────────────
echo "[$(date)] Creating systemd service..."
cat > /etc/systemd/system/avatar-worker.service << 'SYSTEMD_EOF'
[Unit]
Description=Avatar GPU Worker (MuseTalk Lip Sync)
After=network-online.target docker.service
Requires=docker.service
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=15
StartLimitIntervalSec=0

# Stop + remove old container on start
ExecStartPre=-/usr/bin/docker stop avatar-worker-container
ExecStartPre=-/usr/bin/docker rm avatar-worker-container

# Run the GPU worker container
ExecStart=/usr/bin/docker run \
  --name avatar-worker-container \
  --rm \
  --gpus all \
  -e GCP_PROJECT_ID=__PROJECT_ID__ \
  -e GCS_BUCKET=__BUCKET_NAME__ \
  -e PUBSUB_SUBSCRIPTION=__SUBSCRIPTION__ \
  -e USE_FLOAT16=true \
  -e BBOX_SHIFT=-7 \
  -v /tmp/musetalk-work:/tmp/musetalk-work \
  __WORKER_IMAGE__

ExecStop=/usr/bin/docker stop avatar-worker-container

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
systemctl enable avatar-worker.service
systemctl restart avatar-worker.service

echo "[$(date)] ✅ Startup script complete. Worker service started."
