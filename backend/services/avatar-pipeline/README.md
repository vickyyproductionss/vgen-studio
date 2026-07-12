# Avatar Pipeline - GCP Setup

## Overview

Cloud-based AI lip-sync service. Takes avatar image + audio → outputs talking head MP4.

**Stack:**
- **Cloud Run** — Stateless API (FastAPI/Python)
- **Pub/Sub** — Job queue
- **GPU VM (L4)** — MuseTalk inference worker
- **Cloud Storage** — Inputs/outputs

---

## Quick Start

### 1. Deploy GCP Infrastructure

```bash
cd backend/services/avatar-pipeline/infra
chmod +x setup.sh
bash setup.sh
```

This creates everything: bucket, Pub/Sub, Cloud Run, GPU VM (~15 min).

### 2. Set Environment Variable

After setup.sh completes, copy the Cloud Run URL and add to `backend/.env`:

```env
AVATAR_API_URL=https://avatar-api-xxxx-el.a.run.app
```

Restart the backend — the app will automatically use GCP instead of local SadTalker.

### 3. Test the API

```bash
# Health check
curl $AVATAR_API_URL/health

# Upload avatar
curl -X POST $AVATAR_API_URL/upload/avatar \
  -F "file=@/path/to/avatar.png"

# Upload audio  
curl -X POST $AVATAR_API_URL/upload/audio \
  -F "file=@/path/to/audio.wav"

# Start job (use GCS URIs from above)
curl -X POST $AVATAR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{"avatarGcsUri":"gs://vgen-avatar-pipeline/uploads/avatars/xxx.png","audioGcsUri":"gs://vgen-avatar-pipeline/uploads/audio/xxx.wav"}'

# Poll status
curl $AVATAR_API_URL/status/{jobId}

# Get result
curl $AVATAR_API_URL/result/{jobId}
```

---

## Architecture

```
VideoGenerator App
  ↓ POST /api/youtube/generate-avatar
backend/services/gcpAvatar.js
  ↓ Upload avatar + audio to GCS
  ↓ POST /generate to Cloud Run
  ↓ Poll /status/:jobId every 3s
Cloud Run API (avatar-api)
  ↓ Publishes to Pub/Sub topic: avatar-jobs
GPU Worker VM (avatar-gpu-worker)
  ↓ Pulls from Pub/Sub
  ↓ Downloads files from GCS
  ↓ Runs MuseTalk (lip sync)
  ↓ Runs FFmpeg (render 1080p H264)
  ↓ Uploads result to GCS
  ↓ Updates status.json in GCS
Cloud Storage: outputs/videos/{jobId}.mp4
```

---

## File Structure

```
avatar-pipeline/
  api/
    main.py           ← Cloud Run FastAPI service
    requirements.txt
    Dockerfile
  worker/
    worker.py         ← Pub/Sub subscriber + pipeline runner
    requirements.txt
    Dockerfile        ← CUDA 12.1 + MuseTalk
  infra/
    setup.sh          ← One-command GCP provisioning
    startup-script.sh ← VM boot script (installs Docker, starts worker)
  README.md
```

---

## Cost Estimate (per 1-min video)

| Component | Cost |
|---|---|
| L4 GPU VM (~2 min processing) | ₹2–5 |
| Cloud Storage (500MB) | < ₹1 |
| Cloud Run API | < ₹0.01 |
| **Total** | **₹3–6** |

> VM is on-demand. Stop it when not in use: `gcloud compute instances stop avatar-gpu-worker --zone=asia-south1-a`

---

## VM Management

```bash
# Stop VM (save cost when not needed)
gcloud compute instances stop avatar-gpu-worker --zone=asia-south1-a

# Start VM  
gcloud compute instances start avatar-gpu-worker --zone=asia-south1-a

# SSH into VM
gcloud compute ssh avatar-gpu-worker --zone=asia-south1-a

# Check worker logs
sudo journalctl -u avatar-worker.service -f

# Check GPU
nvidia-smi
```

---

## Phase 2 Additions (After MVP)

- [ ] Whisper Large v3 transcription
- [ ] Gemini 2.5 Flash emotion analysis
- [ ] LivePortrait head motion (with stock driving video)
- [ ] GFPGAN face enhancement
- [ ] Auto-start/stop VM based on queue depth
