#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SADTALKER_DIR="$BACKEND_DIR/sadtalker"

echo "=== SadTalker Local Installation & Setup ==="

# 1. Clone SadTalker repository if not already present
if [ ! -d "$SADTALKER_DIR" ]; then
    echo "Cloning SadTalker repository..."
    git clone https://github.com/OpenTalker/SadTalker.git "$SADTALKER_DIR"
else
    echo "SadTalker repository already exists at $SADTALKER_DIR"
fi

cd "$SADTALKER_DIR"

# 2. Check for conda
if ! command -v conda &> /dev/null; then
    echo "Error: conda is not installed. Please install Miniconda or Anaconda first."
    exit 1
fi

# 3. Create conda environment
if conda env list | grep -q "sadtalker"; then
    echo "Conda environment 'sadtalker' already exists."
else
    echo "Creating Conda environment 'sadtalker' with Python 3.10..."
    conda create -y -n sadtalker python=3.10
fi

# 4. Install dependencies inside Conda environment
echo "Installing PyTorch and dependencies inside 'sadtalker' env..."
conda run -n sadtalker pip install torch torchvision torchaudio
conda run -n sadtalker pip install -r requirements.txt

# dlib is often required by SadTalker for face detection
echo "Installing dlib and other helpers..."
conda run -n sadtalker pip install cmake
conda run -n sadtalker pip install dlib || echo "Warning: dlib install failed. Proceeding anyway, it may use alternative face detectors."

# 5. Download pre-trained weights/checkpoints
echo "Downloading pre-trained checkpoints (approx. 2-3 GB)..."
if [ -f "scripts/download_models.sh" ]; then
    # Make sure download scripts use curl if wget is not installed
    if ! command -v wget &> /dev/null; then
        echo "wget not found. Installing wget via Homebrew..."
        brew install wget || true
    fi
    bash scripts/download_models.sh
else
    echo "Error: scripts/download_models.sh not found inside SadTalker directory."
    exit 1
fi

echo "=== SadTalker Setup Complete! ==="
