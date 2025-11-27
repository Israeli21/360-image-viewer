"""
Dense 3D Reconstruction - Focus on Building
Uses depth estimation and multi-view stereo to create a dense point cloud
"""

import cv2
import numpy as np
import os
import json
from pathlib import Path

def load_camera_data():
    """Load camera poses from previous SfM"""
    with open('sfm_output/camera_poses.json', 'r') as f:
        return json.load(f)

def compute_depth_map(img1, img2, min_disp=0, num_disp=128):
    """Compute depth map using stereo matching"""
    # Convert to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Create StereoSGBM object for better quality
    stereo = cv2.StereoSGBM_create(
        minDisparity=min_disp,
        numDisparities=num_disp,
        blockSize=5,
        P1=8 * 3 * 5 ** 2,
        P2=32 * 3 * 5 ** 2,
        disp12MaxDiff=1,
        uniquenessRatio=10,
        speckleWindowSize=100,
        speckleRange=32,
        mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY
    )
    
    # Compute disparity
    disparity = stereo.compute(gray1, gray2).astype(np.float32) / 16.0
    
    return disparity

def disparity_to_depth(disparity, focal_length, baseline=0.1):
    """Convert disparity map to depth map"""
    # Avoid division by zero
    disparity[disparity <= 0] = 0.1
    depth = (focal_length * baseline) / disparity
    return depth

def depth_to_point_cloud(depth, color_img, K, mask=None):
    """Convert depth map to 3D point cloud"""
    h, w = depth.shape
    fx, fy = K[0, 0], K[1, 1]
    cx, cy = K[0, 2], K[1, 2]
    
    points = []
    colors = []
    
    for v in range(h):
        for u in range(w):
            if mask is not None and mask[v, u] == 0:
                continue
                
            z = depth[v, u]
            
            # Filter out invalid depths
            if z <= 0 or z > 10:  # Only keep points within 10 units
                continue
            
            # Back-project to 3D
            x = (u - cx) * z / fx
            y = (v - cy) * z / fy
            
            points.append([x, y, z])
            colors.append(color_img[v, u][::-1])  # BGR to RGB
    
    return np.array(points), np.array(colors)

def create_building_mask(img):
    """Create a mask to focus on the building (center region)"""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    
    # Focus on center region where building is likely to be
    center_w = int(w * 0.6)  # 60% width
    center_h = int(h * 0.8)  # 80% height
    x1 = (w - center_w) // 2
    y1 = (h - center_h) // 2
    
    mask[y1:y1+center_h, x1:x1+center_w] = 255
    
    # Use edge detection to refine mask
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Dilate edges to create regions
    kernel = np.ones((5, 5), np.uint8)
    edges_dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Combine center mask with edges
    mask = cv2.bitwise_and(mask, mask, mask=cv2.bitwise_not(edges_dilated))
    
    return mask

def merge_point_clouds(all_points, all_colors, camera_poses):
    """Merge point clouds from multiple views into world coordinates"""
    merged_points = []
    merged_colors = []
    
    for i, (points, colors, pose) in enumerate(zip(all_points, all_colors, camera_poses)):
        if len(points) == 0:
            continue
            
        # Transform points to world coordinates
        R = np.array(pose['rotation_matrix'])
        t = np.array(pose['position'])
        
        # Transform each point
        for point, color in zip(points, colors):
            world_point = R @ point + t
            merged_points.append(world_point)
            merged_colors.append(color)
    
    return np.array(merged_points), np.array(merged_colors)

def filter_outliers(points, colors, std_threshold=2.0):
    """Remove outlier points using statistical filtering"""
    if len(points) == 0:
        return points, colors
    
    # Compute mean and std of distances from centroid
    centroid = np.mean(points, axis=0)
    distances = np.linalg.norm(points - centroid, axis=1)
    mean_dist = np.mean(distances)
    std_dist = np.std(distances)
    
    # Keep points within threshold
    mask = distances < (mean_dist + std_threshold * std_dist)
    
    return points[mask], colors[mask]

def main():
    print("="*60)
    print("Dense 3D Reconstruction - Building Focus")
    print("="*60)
    
    # Load camera data
    camera_data = load_camera_data()
    images_dir = Path("colmap_workspace/images")
    if not images_dir.exists():
        images_dir = Path("src/2D_images")
    
    image_paths = sorted(images_dir.glob("*.png"))
    
    if len(image_paths) < 2:
        print("Error: Need at least 2 images")
        return
    
    print(f"\nLoading {len(image_paths)} images...")
    
    # Camera intrinsics
    K = np.array([
        [camera_data['camera_intrinsics']['fx'], 0, camera_data['camera_intrinsics']['cx']],
        [0, camera_data['camera_intrinsics']['fy'], camera_data['camera_intrinsics']['cy']],
        [0, 0, 1]
    ])
    
    all_points = []
    all_colors = []
    
    # Process consecutive image pairs for depth estimation
    num_pairs = min(10, len(image_paths) - 1)  # Process first 10 pairs
    
    for i in range(num_pairs):
        print(f"\nProcessing pair {i+1}/{num_pairs}...")
        
        img1 = cv2.imread(str(image_paths[i]))
        img2 = cv2.imread(str(image_paths[i+1]))
        
        if img1 is None or img2 is None:
            continue
        
        # Resize images to match if needed
        if img1.shape != img2.shape:
            h, w = min(img1.shape[0], img2.shape[0]), min(img1.shape[1], img2.shape[1])
            img1 = cv2.resize(img1, (w, h))
            img2 = cv2.resize(img2, (w, h))
        
        # Create building mask
        mask = create_building_mask(img1)
        
        # Compute depth
        print("  Computing depth map...")
        disparity = compute_depth_map(img1, img2)
        depth = disparity_to_depth(disparity, K[0, 0])
        
        # Convert to point cloud with building mask
        print("  Generating point cloud...")
        points, colors = depth_to_point_cloud(depth, img1, K, mask)
        
        print(f"  Generated {len(points)} points")
        
        all_points.append(points)
        all_colors.append(colors)
    
    # Merge all point clouds
    print("\nMerging point clouds...")
    merged_points, merged_colors = merge_point_clouds(
        all_points, all_colors, camera_data['images'][:num_pairs]
    )
    
    print(f"Total points before filtering: {len(merged_points)}")
    
    # Filter outliers
    print("Filtering outliers...")
    filtered_points, filtered_colors = filter_outliers(merged_points, merged_colors, std_threshold=1.5)
    
    print(f"Total points after filtering: {len(filtered_points)}")
    
    # Save results
    output_data = camera_data.copy()
    output_data['points_3d'] = filtered_points.tolist()
    output_data['point_colors'] = filtered_colors.tolist()
    
    output_file = Path('sfm_output/camera_poses.json')
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print("\n" + "="*60)
    print("Dense Reconstruction Complete!")
    print("="*60)
    print(f"Final point cloud: {len(filtered_points)} points")
    print(f"Saved to: {output_file}")
    print("\nRestart the app and click the Camera icon to view!")

if __name__ == "__main__":
    main()
