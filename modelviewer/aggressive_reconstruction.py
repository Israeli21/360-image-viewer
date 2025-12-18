"""
Aggressive COLMAP reconstruction - use all possible frames and dense matching
"""
import subprocess
import os
import shutil

# Paths
image_folder = "src/2D_images"
workspace = "colmap_workspace_aggressive"
database = f"{workspace}/database.db"
sparse_dir = f"{workspace}/sparse"
dense_dir = f"{workspace}/dense"

# Clean and create workspace
if os.path.exists(workspace):
    shutil.rmtree(workspace)
os.makedirs(workspace, exist_ok=True)
os.makedirs(sparse_dir, exist_ok=True)
os.makedirs(dense_dir, exist_ok=True)

print("🔧 Running aggressive COLMAP reconstruction...")
print(f"Processing images from: {image_folder}")

# 1. Feature extraction with more features
print("\n1️⃣ Extracting features (aggressive settings)...")
subprocess.run([
    "colmap", "feature_extractor",
    "--database_path", database,
    "--image_path", image_folder,
    "--ImageReader.single_camera", "1",
    "--SiftExtraction.max_num_features", "16384",  # More features
    "--SiftExtraction.first_octave", "-1"
])

# 2. Exhaustive matching with relaxed parameters
print("\n2️⃣ Matching features (relaxed parameters)...")
subprocess.run([
    "colmap", "exhaustive_matcher",
    "--database_path", database,
    "--SiftMatching.guided_matching", "1",
    "--SiftMatching.max_error", "8.0",  # More lenient
    "--SiftMatching.max_ratio", "0.9"   # More lenient
])

# 3. Mapper with relaxed parameters
print("\n3️⃣ Running mapper (forcing all images)...")
subprocess.run([
    "colmap", "mapper",
    "--database_path", database,
    "--image_path", image_folder,
    "--output_path", sparse_dir,
    "--Mapper.ba_refine_focal_length", "1",
    "--Mapper.ba_refine_extra_params", "1",
    "--Mapper.min_num_matches", "10",  # Lower threshold
    "--Mapper.init_min_num_inliers", "50",  # Lower threshold
    "--Mapper.abs_pose_min_num_inliers", "15",  # Lower threshold
    "--Mapper.filter_min_tri_angle", "1.5"  # More lenient
])

# 4. Image undistortion for dense reconstruction
print("\n4️⃣ Undistorting images for dense reconstruction...")
subprocess.run([
    "colmap", "image_undistorter",
    "--image_path", image_folder,
    "--input_path", f"{sparse_dir}/0",
    "--output_path", dense_dir,
    "--output_type", "COLMAP"
])

# 5. Dense stereo matching
print("\n5️⃣ Computing dense stereo (this will take time)...")
subprocess.run([
    "colmap", "patch_match_stereo",
    "--workspace_path", dense_dir,
    "--PatchMatchStereo.max_image_size", "2000",
    "--PatchMatchStereo.window_radius", "5",
    "--PatchMatchStereo.num_samples", "15",
    "--PatchMatchStereo.num_iterations", "5"
])

# 6. Stereo fusion to create dense point cloud
print("\n6️⃣ Fusing stereo into dense point cloud...")
subprocess.run([
    "colmap", "stereo_fusion",
    "--workspace_path", dense_dir,
    "--output_path", f"{dense_dir}/fused.ply",
    "--StereoFusion.min_num_pixels", "3",
    "--StereoFusion.max_reproj_error", "4.0"
])

# 7. Export results
print("\n7️⃣ Exporting results...")

# Export sparse reconstruction
subprocess.run([
    "colmap", "model_converter",
    "--input_path", f"{sparse_dir}/0",
    "--output_path", f"{workspace}/sparse_points.ply",
    "--output_type", "PLY"
])

print("\n" + "="*60)
print("✅ AGGRESSIVE RECONSTRUCTION COMPLETE!")
print("="*60)

# Check results
if os.path.exists(f"{dense_dir}/fused.ply"):
    # Count points in dense PLY
    with open(f"{dense_dir}/fused.ply", 'rb') as f:
        for line in f:
            if line.startswith(b'element vertex'):
                dense_points = int(line.split()[-1])
                print(f"🎉 Dense point cloud: {dense_points:,} points")
                print(f"📁 Location: {dense_dir}/fused.ply")
                break

if os.path.exists(f"{workspace}/sparse_points.ply"):
    with open(f"{workspace}/sparse_points.ply", 'rb') as f:
        for line in f:
            if line.startswith(b'element vertex'):
                sparse_points = int(line.split()[-1])
                print(f"📊 Sparse point cloud: {sparse_points:,} points")
                break

print(f"\n📂 All results in: {workspace}/")
print("\nNext: Convert dense point cloud to GLB for viewing")
