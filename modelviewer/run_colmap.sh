#!/bin/bash

# COLMAP Automatic Reconstruction Script
# This script runs COLMAP on your extracted 2D images

echo "========================================"
echo "COLMAP Structure from Motion Pipeline"
echo "========================================"
echo ""

# Create workspace directories
echo "Creating workspace directories..."
mkdir -p colmap_workspace/images
mkdir -p colmap_workspace/sparse
mkdir -p colmap_workspace/dense

# Copy images
echo "Copying images from src/2D_images..."
cp src/2D_images/*.jpg colmap_workspace/images/ 2>/dev/null || true
cp src/2D_images/*.png colmap_workspace/images/ 2>/dev/null || true

echo ""
echo "Images copied to colmap_workspace/images"
echo ""

# Check if COLMAP is installed
if ! command -v colmap &> /dev/null; then
    echo "ERROR: COLMAP is not installed or not in PATH"
    echo ""
    echo "Please install COLMAP:"
    echo "  macOS: brew install colmap"
    echo "  Linux: sudo apt install colmap"
    echo "  Or download from: https://github.com/colmap/colmap/releases"
    echo ""
    exit 1
fi

echo "COLMAP found! Starting reconstruction..."
echo ""
echo "This will take several minutes. Please wait..."
echo ""

# Run COLMAP automatic reconstruction
colmap automatic_reconstructor \
  --workspace_path colmap_workspace \
  --image_path colmap_workspace/images \
  --sparse 1 \
  --dense 0

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "SUCCESS! Reconstruction complete"
    echo "========================================"
    echo ""
    echo "Results saved to:"
    echo "  - Sparse reconstruction: colmap_workspace/sparse/0"
    echo ""
    echo "Next steps:"
    echo "1. Export to TXT format:"
    echo "   colmap model_converter --input_path colmap_workspace/sparse/0 --output_path colmap_workspace/sparse/0 --output_type TXT"
    echo ""
    echo "2. Export point cloud:"
    echo "   colmap model_converter --input_path colmap_workspace/sparse/0 --output_path colmap_workspace/pointcloud.ply --output_type PLY"
    echo ""
else
    echo ""
    echo "========================================"
    echo "ERROR: Reconstruction failed"
    echo "========================================"
    echo ""
    echo "Check the error messages above for details"
    echo ""
    exit 1
fi
