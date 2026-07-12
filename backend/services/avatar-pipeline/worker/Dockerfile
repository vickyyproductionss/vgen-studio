# GPU Worker - MuseTalk on NVIDIA L4
# Base: CUDA 12.1 + cuDNN8 + Ubuntu 22.04
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip python3.10-dev \
    git wget curl ffmpeg \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.10 /usr/bin/python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    pip3 install --upgrade pip

# ── PyTorch (CUDA 12.1) ───────────────────────────────────────────────────────
RUN pip3 install --no-cache-dir \
    torch==2.3.0 torchvision==0.18.0 torchaudio==2.3.0 \
    --index-url https://download.pytorch.org/whl/cu121

# ── OpenMMLab stack (required by MuseTalk) ────────────────────────────────────
RUN pip3 install --no-cache-dir setuptools==69.5.1 openmim && \
    pip3 install --no-cache-dir --no-build-isolation chumpy && \
    mim install mmengine==0.10.4 "mmcv>=2.1.0" mmdet==3.3.0 mmpose==1.3.2

# ── Clone + install MuseTalk ──────────────────────────────────────────────────
RUN git clone https://github.com/TMElyralab/MuseTalk.git /app/MuseTalk
WORKDIR /app/MuseTalk
RUN pip3 install --no-cache-dir -r requirements.txt

# ── Download MuseTalk model weights ──────────────────────────────────────────
# Models are stored in GCS and downloaded at runtime to save image size.
# Alternatively, uncomment to bake into image (larger but faster cold start):
# RUN python3 -c "from scripts.download_weights import download_all; download_all()"

# ── Worker code ───────────────────────────────────────────────────────────────
WORKDIR /app/worker
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY worker.py .

ENV MUSETALK_DIR=/app/MuseTalk
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV PYTHONPATH=/app/MuseTalk

CMD ["python3", "worker.py"]
