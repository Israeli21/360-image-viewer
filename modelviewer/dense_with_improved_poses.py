"""
Dense 3D reconstruction using improved camera poses
Creates dense point cloud focused on the building
"""

import cv2
import numpy as np
import json
from pathlib import Path

def load_camera_poses(json_path="sfm_output/camera_poses.json"):
    """Load camera poses from JSON"""
    with open(json_path, 'r') as f:
        data = json.load(f)
    return data

def create_dense_points_stereo(img1, img2, K, pose1, pose2, min_depth=0.5, max_depth=20):
    """
    Create dense 3D points using stereo matching
    """
    # Convert to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Resize if needed to match dimensions
    h = min(gray1.shape[0], gray2.shape[0])
    w = min(gray1.shape[1], gray2.shape[1])
    gray1 = cv2.resize(gray1, (w, h))
    gray2 = cv2.resize(gray2, (w, h))
    img1_resized = cv2.resize(img1, (w, h))
    
    # Stereo matching with better parameters
    stereo = cv2.StereoSGBM_create(
        minDisparity=0,
        numDisparities=128,  # Must be divisible by 16
        blockSize=5,
        P1=8 * 3 * 5**2,
        P2=32 * 3 * 5**2,
        disp12MaxDiff=1,
        uniquenessRatio=10,
        speckleWindowSize=100,
        speckleRange=32,
        mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY
    )
    
    # Compute disparity
    disparity = stereo.compute(gray1, gray2).astype(np.float32) / 16.0
    
    # Calculate baseline (distance between cameras)
    baseline = np.linalg.norm(pose2[:3, 3] - pose1[:3, 3])
    
    if baseline < 0.01:  # Too close
        return np.array([]), np.array([])
    
    # Convert disparity to depth
    focal_length = K[0, 0]
    depth_map = np.zeros_like(disparity)
    valid_disp = disparity > 0
    depth_map[valid_disp] = (focal_length * baseline) / disparity[valid_disp]
    
    # Create building mask (focus on center of image where building should be)
    mask = np.zeros((h, w), dtype=np.uint8)
    center_x, center_y = w // 2, h // 2
    mask_w, mask_h = int(w * 0.7), int(h * 0.7)
    x1 = max(0, center_x - mask_w // 2)
    x2 = min(w, center_x + mask_w // 2)
    y1 = max(0, center_y - mask_h // 2)
    y2 = min(h, center_y + mask_h // 2)
    mask[y1:y2, x1:x2] = 255
    
    # Apply depth and mask filters
    valid_mask = (depth_map > min_depth) & (depth_map < max_depth) & (mask > 0) & valid_disp
    
    # Get 3D points
    points_3d = []
    colors = []
    
    cx, cy = K[0, 2], K[1, 2]
    fx, fy = K[0, 0], K[1, 1]
    
    ys, xs = np.where(valid_mask)
    for x, y in zip(xs, ys):
        d = depth_map[y, x]
        
        # Back-project to 3D (in camera 1 coordinate system)
        X_cam = (x - cx) * d / fx
        Y_cam = (y - cy) * d / fy
        Z_cam = d
        
        point_cam = np.array([X_cam, Y_cam, Z_cam, 1.0])
        
        # Transform to world coordinates
        point_world = pose1 @ point_cam
        
        points_3d.append(point_world[:3])
        colors.append(img1_resized[y, x][[2, 1, 0]])  # BGR to RGB
    
    return np.array(points_3d), np.array(colors)

def filter_outliers_statistical(points, colors, k=20, std_thresh=2.0):
    """Remove statistical outliers - fast version using voxel downsampling first"""
    if len(points) < k:
        return points, colors
    
    # For very large point clouds, use spatial filtering instead
    if len(points) > 500000:
        print(f"  Using spatial filtering for {len(points)} points...")
        # Remove points too far from camera trajectory median
        median_pos = np.median(points, axis=0)
        distances_from_center = np.linalg.norm(points - median_pos, axis=1)
        
        # Keep points within reasonable distance
        threshold = np.percentile(distances_from_center, 95)
        inliers = distances_from_center < threshold
        
        return points[inliers], colors[inliers]
    
    from scipy.spatial import KDTree
    tree = KDTree(points)
    
    # Find k nearest neighbors for each point
    distances, _ = tree.query(points, k=k+1)  # k+1 because point itself is included
    mean_distances = distances[:, 1:].mean(axis=1)  # Skip first (self)
    
    # Filter based on statistics
    global_mean = mean_distances.mean()
    global_std = mean_distances.std()
    threshold = global_mean + std_thresh * global_std
    
    inliers = mean_distances < threshold
    
    return points[inliers], colors[inliers]

def main():
    print("="*60)
    print("DENSE RECONSTRUCTION WITH IMPROVED POSES")
    print("="*60)
    
    # Load camera poses
    data = load_camera_poses()
    images_dir = Path("src/2D_images")
    
    # Build intrinsics matrix
    intr = data["camera_intrinsics"]
    K = np.array([
        [intr["fx"], 0, intr["cx"]],
        [0, intr["fy"], intr["cy"]],
        [0, 0, 1]
    ])
    
    print(f"\nLoaded {len(data['images'])} camera poses")
    print(f"Existing sparse points: {len(data.get('points_3d', []))}")
    
    # Process image pairs for dense reconstruction
    all_points = []
    all_colors = []
    
    print("\nProcessing image pairs for dense reconstruction...")
    
    for i in range(len(data["images"]) - 1):
        img_info1 = data["images"][i]
        img_info2 = data["images"][i+1]
        
        # Load images
        img1_path = images_dir / img_info1["name"]
        img2_path = images_dir / img_info2["name"]
        
        if not img1_path.exists() or not img2_path.exists():
            continue
        
        img1 = cv2.imread(str(img1_path))
        img2 = cv2.imread(str(img2_path))
        
        if img1 is None or img2 is None:
            continue
        
        # Get camera poses
        pose1 = np.array(img_info1["camera_pose"])
        pose2 = np.array(img_info2["camera_pose"])
        
        # Check if cameras moved enough
        baseline = np.linalg.norm(pose2[:3, 3] - pose1[:3, 3])
        
        if baseline < 0.1:  # Skip pairs with very small baseline
            print(f"  Pair {i}-{i+1}: Skipped (baseline too small: {baseline:.3f})")
            continue
        
        # Generate dense points
        points_3d, colors = create_dense_points_stereo(img1, img2, K, pose1, pose2)
        
        if len(points_3d) > 0:
            all_points.extend(points_3d.tolist())
            all_colors.extend(colors.tolist())
            print(f"  Pair {i}-{i+1}: {len(points_3d)} points (baseline: {baseline:.3f})")
        else:
            print(f"  Pair {i}-{i+1}: No points generated")
    
    if len(all_points) == 0:
        print("\nERROR: No points generated!")
        return
    
    all_points = np.array(all_points)
    all_colors = np.array(all_colors)
    
    print(f"\nTotal points before filtering: {len(all_points)}")
    
    # Filter outliers
    print("Filtering outliers...")
    try:
        all_points, all_colors = filter_outliers_statistical(all_points, all_colors)
        print(f"Points after filtering: {len(all_points)}")
    except Exception as e:
        print(f"Warning: Outlier filtering failed: {e}")
    
    # Update the data with dense points
    data["points_3d"] = all_points.tolist()
    data["point_colors"] = all_colors.tolist()
    
    # Save
    output_path = Path("sfm_output/camera_poses.json")
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\nSaved dense point cloud to: {output_path}")
    print(f"Total points: {len(all_points)}")
    
    # Statistics
    if len(all_points) > 0:
        print(f"\nPoint cloud bounds:")
        print(f"  X: [{all_points[:, 0].min():.2f}, {all_points[:, 0].max():.2f}]")
        print(f"  Y: [{all_points[:, 1].min():.2f}, {all_points[:, 1].max():.2f}]")
        print(f"  Z: [{all_points[:, 2].min():.2f}, {all_points[:, 2].max():.2f}]")
    
    print("\n" + "="*60)
    print("DONE! Restart the app and click Camera icon.")
    print("="*60)

if __name__ == "__main__":
    main()
