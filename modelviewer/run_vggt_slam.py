"""
VGGT-SLAM Runner Script
This script runs VGGT-SLAM on the extracted 2D images and converts the output
to a format compatible with the modelviewer application.
"""

import os
import sys
import subprocess
import json
import numpy as np
from pathlib import Path
import shutil

# Configuration
MODELVIEWER_ROOT = Path(__file__).parent
IMAGE_FOLDER = MODELVIEWER_ROOT / "src" / "2D_images"
VGGT_SLAM_DIR = MODELVIEWER_ROOT / "vggt_slam_integration"
OUTPUT_DIR = MODELVIEWER_ROOT / "vggt_output"
CAMERA_POSES_OUTPUT = MODELVIEWER_ROOT / "src" / "public" / "camera_poses.json"

def check_vggt_slam_installed():
    """Check if VGGT-SLAM is installed"""
    if not VGGT_SLAM_DIR.exists():
        print("❌ VGGT-SLAM is not installed.")
        print("Please run setup_vggt_slam.sh (Linux/WSL) or setup_vggt_slam.bat (Windows) first.")
        sys.exit(1)
    
    main_py = VGGT_SLAM_DIR / "main.py"
    if not main_py.exists():
        print(f"❌ VGGT-SLAM main.py not found at {main_py}")
        sys.exit(1)
    
    print("✅ VGGT-SLAM installation found")

def check_images_exist():
    """Check if 2D images exist"""
    if not IMAGE_FOLDER.exists():
        print(f"❌ Image folder not found: {IMAGE_FOLDER}")
        sys.exit(1)
    
    images = list(IMAGE_FOLDER.glob("*.jpg")) + list(IMAGE_FOLDER.glob("*.png"))
    if len(images) == 0:
        print(f"❌ No images found in {IMAGE_FOLDER}")
        sys.exit(1)
    
    print(f"✅ Found {len(images)} images in {IMAGE_FOLDER}")
    return len(images)

def run_vggt_slam(submap_size=16, max_loops=1, min_disparity=50):
    """Run VGGT-SLAM on the images"""
    print("\n" + "="*60)
    print("Running VGGT-SLAM...")
    print("="*60)
    
    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Log file path
    log_file = OUTPUT_DIR / "camera_poses.txt"
    
    # VGGT-SLAM command
    cmd = [
        sys.executable,
        str(VGGT_SLAM_DIR / "main.py"),
        "--image_folder", str(IMAGE_FOLDER),
        "--submap_size", str(submap_size),
        "--max_loops", str(max_loops),
        "--min_disparity", str(min_disparity),
        "--conf_threshold", "25.0",
        "--log_results",
        "--log_path", str(log_file),
        "--vis_map"  # Visualize the map as it's being built
    ]
    
    print(f"Command: {' '.join(cmd)}")
    print("\nNote: This may take several minutes depending on the number of images...")
    print("A visualization window will open showing the 3D reconstruction.\n")
    
    try:
        # Change to VGGT-SLAM directory and run
        result = subprocess.run(
            cmd,
            cwd=str(VGGT_SLAM_DIR),
            check=True,
            capture_output=False,
            text=True
        )
        print("✅ VGGT-SLAM completed successfully")
        return log_file
    except subprocess.CalledProcessError as e:
        print(f"❌ VGGT-SLAM failed with error code {e.returncode}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error running VGGT-SLAM: {e}")
        sys.exit(1)

def parse_tum_format(log_file):
    """
    Parse TUM format trajectory file
    Format: timestamp tx ty tz qx qy qz qw
    Returns list of poses with position and quaternion
    """
    poses = []
    
    with open(log_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            parts = line.split()
            if len(parts) >= 8:
                timestamp = float(parts[0])
                tx, ty, tz = float(parts[1]), float(parts[2]), float(parts[3])
                qx, qy, qz, qw = float(parts[4]), float(parts[5]), float(parts[6]), float(parts[7])
                
                poses.append({
                    "timestamp": timestamp,
                    "position": [tx, ty, tz],
                    "quaternion": [qx, qy, qz, qw]
                })
    
    return poses

def quaternion_to_rotation_matrix(q):
    """Convert quaternion (qx, qy, qz, qw) to 3x3 rotation matrix"""
    qx, qy, qz, qw = q
    
    R = np.array([
        [1 - 2*(qy**2 + qz**2), 2*(qx*qy - qz*qw), 2*(qx*qz + qy*qw)],
        [2*(qx*qy + qz*qw), 1 - 2*(qx**2 + qz**2), 2*(qy*qz - qx*qw)],
        [2*(qx*qz - qy*qw), 2*(qy*qz + qx*qw), 1 - 2*(qx**2 + qy**2)]
    ])
    
    return R

def convert_to_modelviewer_format(poses, image_folder):
    """Convert VGGT-SLAM poses to modelviewer camera_poses.json format"""
    
    images = sorted(list(image_folder.glob("*.jpg")) + list(image_folder.glob("*.png")))
    
    camera_data = []
    
    for i, pose in enumerate(poses):
        if i >= len(images):
            break
        
        # Get rotation matrix from quaternion
        R = quaternion_to_rotation_matrix(pose["quaternion"])
        t = np.array(pose["position"]).reshape(3, 1)
        
        # Create 4x4 transformation matrix
        transform = np.eye(4)
        transform[:3, :3] = R
        transform[:3, 3] = t.flatten()
        
        camera_entry = {
            "image_path": f"2D_images/{images[i].name}",
            "camera_matrix": transform.tolist(),
            "position": pose["position"],
            "quaternion": pose["quaternion"]
        }
        
        camera_data.append(camera_entry)
    
    return {"cameras": camera_data, "source": "VGGT-SLAM"}

def save_camera_poses(camera_data, output_file):
    """Save camera poses to JSON file"""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump(camera_data, f, indent=2)
    
    print(f"✅ Saved camera poses to {output_file}")

def main():
    print("="*60)
    print("VGGT-SLAM Integration for ModelViewer")
    print("="*60)
    print()
    
    # Step 1: Check installation
    check_vggt_slam_installed()
    
    # Step 2: Check images
    num_images = check_images_exist()
    
    # Step 3: Run VGGT-SLAM
    log_file = run_vggt_slam(submap_size=16, max_loops=3, min_disparity=30)
    
    # Step 4: Parse results
    print("\nParsing VGGT-SLAM output...")
    poses = parse_tum_format(log_file)
    print(f"✅ Parsed {len(poses)} camera poses")
    
    # Step 5: Convert to modelviewer format
    print("\nConverting to modelviewer format...")
    camera_data = convert_to_modelviewer_format(poses, IMAGE_FOLDER)
    
    # Step 6: Save to output
    save_camera_poses(camera_data, CAMERA_POSES_OUTPUT)
    
    # Also save a backup
    backup_file = OUTPUT_DIR / "camera_poses_backup.json"
    save_camera_poses(camera_data, backup_file)
    
    print("\n" + "="*60)
    print("✅ Integration Complete!")
    print("="*60)
    print(f"\nCamera poses saved to:")
    print(f"  - {CAMERA_POSES_OUTPUT}")
    print(f"  - {backup_file} (backup)")
    print(f"\nTotal cameras: {len(camera_data['cameras'])}")
    print("\nYou can now use these camera poses in your modelviewer application!")
    
    # Check if point cloud was generated
    glb_file = VGGT_SLAM_DIR / "scene.glb"
    if glb_file.exists():
        output_glb = OUTPUT_DIR / "scene.glb"
        shutil.copy(glb_file, output_glb)
        print(f"\n✅ 3D point cloud saved to: {output_glb}")
        print("   You can view this in your modelviewer!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
