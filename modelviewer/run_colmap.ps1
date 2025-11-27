# COLMAP Runner
$ErrorActionPreference = "Stop"
$COLMAP = "C:\Program Files\COLMAP\bin\colmap.exe"

Write-Host "========================================"
Write-Host "COLMAP Structure from Motion Pipeline"
Write-Host "========================================"
Write-Host ""

# Create directories
Write-Host "Creating workspace directories..."
New-Item -ItemType Directory -Force -Path "colmap_workspace\images" | Out-Null
New-Item -ItemType Directory -Force -Path "colmap_workspace\sparse" | Out-Null

# Copy images
Write-Host "Copying images..."
Copy-Item "src\2D_images\*.png" "colmap_workspace\images\" -Force
Copy-Item "src\2D_images\*.jpg" "colmap_workspace\images\" -Force -ErrorAction SilentlyContinue

$imageCount = (Get-ChildItem "colmap_workspace\images\").Count
Write-Host "Copied $imageCount images"
Write-Host ""

# Step 1: Feature Extraction
Write-Host "Step 1/3: Extracting features..."
Write-Host "This may take 2-5 minutes..."
& $COLMAP feature_extractor --database_path "colmap_workspace\database.db" --image_path "colmap_workspace\images" --ImageReader.single_camera 0 --ImageReader.camera_model SIMPLE_RADIAL --SiftExtraction.use_gpu 0

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Feature extraction failed"
    exit 1
}
Write-Host "Feature extraction complete"
Write-Host ""

# Step 2: Feature Matching
Write-Host "Step 2/3: Matching features..."
Write-Host "This may take 1-3 minutes..."
& $COLMAP sequential_matcher --database_path "colmap_workspace\database.db"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Feature matching failed"
    exit 1
}
Write-Host "Feature matching complete"
Write-Host ""

# Step 3: Sparse Reconstruction
Write-Host "Step 3/3: Building 3D reconstruction..."
Write-Host "This may take 1-5 minutes..."
& $COLMAP mapper --database_path "colmap_workspace\database.db" --image_path "colmap_workspace\images" --output_path "colmap_workspace\sparse"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Reconstruction failed"
    Write-Host "Possible reasons:"
    Write-Host "  - Images do not have enough overlap"
    Write-Host "  - Images are too similar"
    Write-Host "  - Camera parameters could not be estimated"
    exit 1
}
Write-Host "Reconstruction complete"
Write-Host ""

# Export results
Write-Host "Exporting results..."
& $COLMAP model_converter --input_path "colmap_workspace\sparse\0" --output_path "colmap_workspace\sparse\0" --output_type TXT
& $COLMAP model_converter --input_path "colmap_workspace\sparse\0" --output_path "colmap_workspace\pointcloud.ply" --output_type PLY

Write-Host ""
Write-Host "========================================"
Write-Host "SUCCESS! Reconstruction complete"
Write-Host "========================================"
Write-Host ""
Write-Host "Results:"
Write-Host "  - Point cloud: colmap_workspace\pointcloud.ply"
Write-Host "  - Camera poses: colmap_workspace\sparse\0\images.txt"
Write-Host "  - Camera intrinsics: colmap_workspace\sparse\0\cameras.txt"
Write-Host "  - 3D points: colmap_workspace\sparse\0\points3D.txt"
