#!/bin/bash
# Setup script for VGGT-SLAM integration with modelviewer
# This script will clone and setup VGGT-SLAM in a separate directory

set -e  # Exit on error

echo "=========================================="
echo "VGGT-SLAM Setup for ModelViewer"
echo "=========================================="

# Create a directory for VGGT-SLAM
VGGT_DIR="vggt_slam_integration"

if [ -d "$VGGT_DIR" ]; then
    echo "VGGT-SLAM directory already exists. Skipping clone."
else
    echo "Cloning VGGT-SLAM repository..."
    git clone https://github.com/MIT-SPARK/VGGT-SLAM.git "$VGGT_DIR"
fi

cd "$VGGT_DIR"

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "Error: conda is not installed. Please install Anaconda or Miniconda first."
    echo "Download from: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

# Create conda environment if it doesn't exist
if conda env list | grep -q "vggt-slam"; then
    echo "Conda environment 'vggt-slam' already exists."
else
    echo "Creating conda environment 'vggt-slam'..."
    conda create -n vggt-slam python=3.11 -y
fi

echo "Activating conda environment..."
eval "$(conda shell.bash hook)"
conda activate vggt-slam

echo "Installing system dependencies (requires sudo)..."
echo "You may be prompted for your password."
sudo apt-get update
sudo apt-get install -y git python3-pip libboost-all-dev cmake gcc g++ unzip

echo "Running VGGT-SLAM setup script..."
chmod +x setup.sh
./setup.sh

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To use VGGT-SLAM, activate the conda environment:"
echo "  conda activate vggt-slam"
echo ""
echo "Then run the integration script:"
echo "  python ../run_vggt_slam.py"
echo ""
