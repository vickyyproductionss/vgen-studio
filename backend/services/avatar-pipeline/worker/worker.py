"""
GPU Worker - Pub/Sub Subscriber + MuseTalk Pipeline Runner
Runs on the GPU VM (NVIDIA L4, g2-standard-8)
Pulls jobs from Pub/Sub, runs MuseTalk inference, uploads result to GCS.
"""

import os, json, time, uuid, subprocess, tempfile, shutil, traceback
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger
from google.cloud import storage, pubsub_v1

# ─── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID    = os.environ.get("GCP_PROJECT_ID", "flowsocial-498207")
BUCKET_NAME   = os.environ.get("GCS_BUCKET", "vgen-avatar-pipeline")
SUBSCRIPTION  = os.environ.get("PUBSUB_SUBSCRIPTION", "avatar-worker-sub")
MUSETALK_DIR  = os.environ.get("MUSETALK_DIR", "/app/MuseTalk")
FFMPEG_PATH   = os.environ.get("FFMPEG_PATH", "/usr/bin/ffmpeg")
USE_FLOAT16   = os.environ.get("USE_FLOAT16", "true").lower() == "true"
BBOX_SHIFT    = int(os.environ.get("BBOX_SHIFT", "-7"))

gcs_client    = storage.Client(project=PROJECT_ID)
bucket        = gcs_client.bucket(BUCKET_NAME)
subscriber    = pubsub_v1.SubscriberClient()
sub_path      = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION)


# ─── GCS Helpers ───────────────────────────────────────────────────────────────
def update_job_status(job_id: str, **fields):
    """Read current status.json, merge fields, write back."""
    blob = bucket.blob(f"temporary/jobs/{job_id}/status.json")
    try:
        data = json.loads(blob.download_as_text())
    except Exception:
        data = {"jobId": job_id}
    data.update(fields)
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    blob.upload_from_string(json.dumps(data, indent=2), content_type="application/json")
    logger.info(f"[{job_id}] Status → {fields}")


def download_gcs_file(gcs_uri: str, local_path: str):
    """Download a gs://bucket/path file to local_path."""
    path = gcs_uri.replace(f"gs://{BUCKET_NAME}/", "")
    blob = bucket.blob(path)
    blob.download_to_filename(local_path)
    logger.info(f"Downloaded {gcs_uri} → {local_path}")


def upload_to_gcs(local_path: str, gcs_path: str) -> str:
    """Upload local file to GCS, return public HTTPS URL."""
    blob = bucket.blob(gcs_path)
    blob.upload_from_filename(local_path)
    blob.make_public()
    url = blob.public_url
    logger.info(f"Uploaded {local_path} → gs://{BUCKET_NAME}/{gcs_path}  ({url})")
    return url


# ─── Pipeline ──────────────────────────────────────────────────────────────────
def run_musetalk(job_id: str, avatar_path: str, audio_path: str, work_dir: str) -> str:
    """
    Run MuseTalk inference.
    Returns path to output MP4.
    """
    result_dir = os.path.join(work_dir, "musetalk_result")
    os.makedirs(result_dir, exist_ok=True)

    # Write MuseTalk YAML config
    config_path = os.path.join(work_dir, "musetalk_config.yaml")
    config_content = f"""test_list:
  - video_path: "{avatar_path}"
    audio_path: "{audio_path}"
"""
    with open(config_path, "w") as f:
        f.write(config_content)

    cmd = [
        "python", "-m", "scripts.inference",
        "--inference_config", config_path,
        "--result_dir", result_dir,
        "--version", "v15",
        "--ffmpeg_path", FFMPEG_PATH,
        "--bbox_shift", str(BBOX_SHIFT),
    ]
    if USE_FLOAT16:
        cmd.append("--use_float16")

    logger.info(f"[{job_id}] Running MuseTalk: {' '.join(cmd)}")
    update_job_status(job_id, stage="lip_sync", progress=20)

    result = subprocess.run(
        cmd,
        cwd=MUSETALK_DIR,
        capture_output=True,
        text=True,
        timeout=3600,  # 1 hour max
    )

    if result.returncode != 0:
        logger.error(f"[{job_id}] MuseTalk stderr: {result.stderr[-2000:]}")
        raise RuntimeError(f"MuseTalk failed (exit {result.returncode}): {result.stderr[-500:]}")

    logger.info(f"[{job_id}] MuseTalk stdout: {result.stdout[-500:]}")

    # Find output MP4
    mp4_files = list(Path(result_dir).rglob("*.mp4"))
    if not mp4_files:
        raise RuntimeError(f"MuseTalk completed but no .mp4 found in {result_dir}")

    output_mp4 = str(max(mp4_files, key=os.path.getmtime))
    logger.info(f"[{job_id}] MuseTalk output: {output_mp4}")
    return output_mp4


def render_final(job_id: str, input_mp4: str, audio_path: str, work_dir: str) -> str:
    """
    Final FFmpeg render: ensure audio is embedded, 1080p, H264, 30fps.
    """
    update_job_status(job_id, stage="rendering", progress=80)
    output_path = os.path.join(work_dir, f"{job_id}_final.mp4")

    cmd = [
        FFMPEG_PATH, "-y",
        "-i", input_mp4,
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]

    logger.info(f"[{job_id}] Running FFmpeg render")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr[-500:]}")

    logger.info(f"[{job_id}] Final render done: {output_path}")
    return output_path


def process_job(job_data: dict):
    """Full pipeline: download → MuseTalk → FFmpeg → upload → update status."""
    job_id     = job_data["jobId"]
    avatar_uri = job_data["avatarUri"]
    audio_uri  = job_data["audioUri"]

    logger.info(f"[{job_id}] Starting job. Avatar: {avatar_uri}  Audio: {audio_uri}")

    # Create a temp working directory
    work_dir = tempfile.mkdtemp(prefix=f"job_{job_id}_")

    try:
        # ── 1. Update status → processing ──────────────────────────────────────
        update_job_status(
            job_id,
            status="processing",
            stage="downloading",
            progress=5,
            startedAt=datetime.now(timezone.utc).isoformat(),
        )

        # ── 2. Download inputs ─────────────────────────────────────────────────
        avatar_ext  = Path(avatar_uri).suffix or ".png"
        audio_ext   = Path(audio_uri).suffix or ".wav"
        avatar_path = os.path.join(work_dir, f"avatar{avatar_ext}")
        audio_path  = os.path.join(work_dir, f"audio{audio_ext}")

        download_gcs_file(avatar_uri, avatar_path)
        download_gcs_file(audio_uri, audio_path)
        update_job_status(job_id, stage="downloaded", progress=10)

        # ── 3. MuseTalk inference ──────────────────────────────────────────────
        lip_synced_mp4 = run_musetalk(job_id, avatar_path, audio_path, work_dir)
        update_job_status(job_id, stage="lip_sync_done", progress=70)

        # ── 4. Final FFmpeg render ─────────────────────────────────────────────
        final_mp4 = render_final(job_id, lip_synced_mp4, audio_path, work_dir)
        update_job_status(job_id, stage="uploading", progress=90)

        # ── 5. Upload result ───────────────────────────────────────────────────
        gcs_output_path = f"outputs/videos/{job_id}.mp4"
        video_url = upload_to_gcs(final_mp4, gcs_output_path)

        # ── 6. Mark done ───────────────────────────────────────────────────────
        update_job_status(
            job_id,
            status="done",
            stage="done",
            progress=100,
            videoUrl=video_url,
            completedAt=datetime.now(timezone.utc).isoformat(),
        )
        logger.info(f"[{job_id}] ✅ Job complete! Video: {video_url}")

    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}"
        logger.error(f"[{job_id}] ❌ Job failed: {err_msg}\n{traceback.format_exc()}")
        update_job_status(job_id, status="error", stage="error", progress=0, error=err_msg)
        raise

    finally:
        # Cleanup temp dir
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.info(f"[{job_id}] Cleaned up temp dir")


# ─── Pub/Sub Subscriber ────────────────────────────────────────────────────────
def message_callback(message: pubsub_v1.subscriber.message.Message):
    """Called by Pub/Sub client when a message arrives."""
    job_id = message.attributes.get("jobId", "unknown")
    logger.info(f"Received job message: {job_id}")

    try:
        job_data = json.loads(message.data.decode("utf-8"))
        process_job(job_data)
        message.ack()
        logger.info(f"[{job_id}] Message ACKed")
    except Exception as e:
        logger.error(f"[{job_id}] Processing failed, NACKing: {e}")
        message.nack()  # Pub/Sub will redeliver after ack deadline


def main():
    logger.info(f"🚀 Avatar Worker starting...")
    logger.info(f"   Project:      {PROJECT_ID}")
    logger.info(f"   Bucket:       {BUCKET_NAME}")
    logger.info(f"   Subscription: {SUBSCRIPTION}")
    logger.info(f"   MuseTalk dir: {MUSETALK_DIR}")
    logger.info(f"   Float16:      {USE_FLOAT16}")

    # Only process 1 job at a time (GPU bottleneck)
    flow_control = pubsub_v1.types.FlowControl(
        max_messages=1,
        max_bytes=50 * 1024 * 1024,  # 50MB
    )

    streaming_pull = subscriber.subscribe(
        sub_path,
        callback=message_callback,
        flow_control=flow_control,
    )

    logger.info(f"Listening for jobs on {sub_path} ...")
    try:
        streaming_pull.result()  # Block forever
    except KeyboardInterrupt:
        streaming_pull.cancel()
        logger.info("Worker stopped by user")


if __name__ == "__main__":
    main()
