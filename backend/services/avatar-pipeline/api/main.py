"""
Avatar Pipeline - Cloud Run API
GCP Project: flowsocial-498207
Region: asia-south1

Endpoints:
  POST /upload          - Upload avatar + audio to GCS, returns GCS URIs
  POST /generate        - Start a lip-sync job, returns jobId
  GET  /status/{jobId}  - Poll job progress
  GET  /result/{jobId}  - Get final video URL
  GET  /health          - Health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uuid, json, os, asyncio
from datetime import datetime, timezone
from google.cloud import storage, pubsub_v1

# ─── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID   = os.environ.get("GCP_PROJECT_ID", "flowsocial-498207")
BUCKET_NAME  = os.environ.get("GCS_BUCKET", "vgen-avatar-pipeline")
PUBSUB_TOPIC = os.environ.get("PUBSUB_TOPIC", "avatar-jobs")

gcs_client     = storage.Client(project=PROJECT_ID)
pubsub_client  = pubsub_v1.PublisherClient()
topic_path     = pubsub_client.topic_path(PROJECT_ID, PUBSUB_TOPIC)
bucket         = gcs_client.bucket(BUCKET_NAME)

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Avatar Pipeline API",
    description="AI talking head generation pipeline - MuseTalk + LivePortrait on GCP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ────────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    avatarGcsUri: str          # gs://bucket/uploads/avatars/xxx.png
    audioGcsUri:  str          # gs://bucket/uploads/audio/xxx.wav
    options: Optional[dict] = {}

class GenerateResponse(BaseModel):
    jobId: str
    message: str

class StatusResponse(BaseModel):
    jobId:      str
    status:     str            # queued | processing | done | error
    stage:      Optional[str]  # downloading | lip_sync | head_motion | merging | uploading
    progress:   int            # 0–100
    elapsedSec: Optional[int]
    error:      Optional[str]

class ResultResponse(BaseModel):
    jobId:    str
    videoUrl: str              # public HTTPS URL to final MP4


# ─── Helpers ───────────────────────────────────────────────────────────────────
def _job_status_blob(job_id: str) -> storage.Blob:
    return bucket.blob(f"temporary/jobs/{job_id}/status.json")

def _write_job_status(job_id: str, data: dict):
    blob = _job_status_blob(job_id)
    blob.upload_from_string(
        json.dumps(data, indent=2),
        content_type="application/json"
    )

def _read_job_status(job_id: str) -> Optional[dict]:
    blob = _job_status_blob(job_id)
    if not blob.exists():
        return None
    return json.loads(blob.download_as_text())


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "avatar-pipeline-api", "project": PROJECT_ID}


@app.post("/upload/avatar")
async def upload_avatar(file: UploadFile = File(...)):
    """Upload an avatar image to Cloud Storage. Returns GCS URI."""
    ext       = os.path.splitext(file.filename or "avatar.png")[1] or ".png"
    file_id   = str(uuid.uuid4())
    gcs_path  = f"uploads/avatars/{file_id}{ext}"

    blob = bucket.blob(gcs_path)
    content = await file.read()
    blob.upload_from_string(content, content_type=file.content_type or "image/png")

    gcs_uri = f"gs://{BUCKET_NAME}/{gcs_path}"
    return {"gcsUri": gcs_uri, "fileId": file_id}


@app.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file to Cloud Storage. Returns GCS URI."""
    ext      = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    file_id  = str(uuid.uuid4())
    gcs_path = f"uploads/audio/{file_id}{ext}"

    blob = bucket.blob(gcs_path)
    content = await file.read()
    blob.upload_from_string(content, content_type=file.content_type or "audio/wav")

    gcs_uri = f"gs://{BUCKET_NAME}/{gcs_path}"
    return {"gcsUri": gcs_uri, "fileId": file_id}


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    """Create a lip-sync job and publish to Pub/Sub for GPU worker to process."""
    job_id = str(uuid.uuid4())

    # Validate GCS URIs exist
    for uri_label, uri in [("avatarGcsUri", req.avatarGcsUri), ("audioGcsUri", req.audioGcsUri)]:
        if not uri.startswith(f"gs://{BUCKET_NAME}/"):
            raise HTTPException(400, f"{uri_label} must be in bucket {BUCKET_NAME}")

    # Write initial job status to GCS
    job_data = {
        "jobId":      job_id,
        "status":     "queued",
        "stage":      "queued",
        "progress":   0,
        "avatarUri":  req.avatarGcsUri,
        "audioUri":   req.audioGcsUri,
        "options":    req.options,
        "createdAt":  datetime.now(timezone.utc).isoformat(),
        "updatedAt":  datetime.now(timezone.utc).isoformat(),
        "error":      None,
        "videoUrl":   None,
    }
    _write_job_status(job_id, job_data)

    # Publish to Pub/Sub
    message = json.dumps(job_data).encode("utf-8")
    future  = pubsub_client.publish(topic_path, message, jobId=job_id)
    future.result(timeout=10)  # Wait for ack

    return GenerateResponse(
        jobId=job_id,
        message="Job queued. Poll /status/{jobId} for progress."
    )


@app.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """Poll job status from Cloud Storage."""
    data = _read_job_status(job_id)
    if not data:
        raise HTTPException(404, f"Job {job_id} not found.")

    elapsed = None
    if data.get("startedAt"):
        try:
            started = datetime.fromisoformat(data["startedAt"])
            elapsed = int((datetime.now(timezone.utc) - started).total_seconds())
        except Exception:
            pass

    return StatusResponse(
        jobId      = job_id,
        status     = data["status"],
        stage      = data.get("stage"),
        progress   = data.get("progress", 0),
        elapsedSec = elapsed,
        error      = data.get("error"),
    )


@app.get("/result/{job_id}", response_model=ResultResponse)
async def get_result(job_id: str):
    """Get the final video URL for a completed job."""
    data = _read_job_status(job_id)
    if not data:
        raise HTTPException(404, f"Job {job_id} not found.")
    if data["status"] != "done":
        raise HTTPException(400, f"Job is not done yet. Status: {data['status']}")
    if not data.get("videoUrl"):
        raise HTTPException(500, "Job completed but no video URL found.")

    return ResultResponse(jobId=job_id, videoUrl=data["videoUrl"])
