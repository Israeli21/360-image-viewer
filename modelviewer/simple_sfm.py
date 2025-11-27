"""
Simple Structure from Motion using OpenCV
Generates camera poses and 3D points from multiple images
"""

import cv2
import numpy as np
import os
import json
from pathlib import Path

def extract_features(image_paths):
    """Extract SIFT features from all images"""
    print("Extracting features...")
    sift = cv2.SIFT_create()
    
    all_keypoints = []
    all_descriptors = []
    
    for i, img_path in enumerate(image_paths):
        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            print(f"Warning: Could not read {img_path}")
            continue
            
        kp, desc = sift.detectAndCompute(img, None)
        all_keypoints.append(kp)
        all_descriptors.append(desc)
        print(f"  {i+1}/{len(image_paths)}: Found {len(kp)} features in {img_path.name}")
    
    return all_keypoints, all_descriptors

def match_features(descriptors):
    """Match features between consecutive images"""
    print("\nMatching features...")
    bf = cv2.BFMatcher()
    matches_list = []
    
    for i in range(len(descriptors) - 1):
        matches = bf.knnMatch(descriptors[i], descriptors[i+1], k=2)
        
        # Apply ratio test
        good_matches = []
        for m, n in matches:
            if m.distance < 0.75 * n.distance:
                good_matches.append(m)
        
        matches_list.append(good_matches)
        print(f"  Images {i} <-> {i+1}: {len(good_matches)} good matches")
    
    return matches_list

def estimate_camera_poses(keypoints, matches, image_shape):
    """Estimate camera poses using essential matrix"""
    print("\nEstimating camera poses...")
    
    # Camera intrinsics (approximate for typical camera)
    h, w = image_shape[:2]
    focal_length = max(w, h)
    cx, cy = w/2, h/2
    K = np.array([
        [focal_length, 0, cx],
        [0, focal_length, cy],
        [0, 0, 1]
    ], dtype=np.float32)
    
    camera_poses = [np.eye(4)]  # First camera at origin
    points_3d = []
    point_colors = []
    
    for i in range(len(matches)):
        if len(matches[i]) < 8:
            print(f"  Warning: Not enough matches between images {i} and {i+1}")
            camera_poses.append(np.eye(4))
            continue
        
        # Get matched points
        pts1 = np.float32([keypoints[i][m.queryIdx].pt for m in matches[i]])
        pts2 = np.float32([keypoints[i+1][m.trainIdx].pt for m in matches[i]])
        
        # Estimate essential matrix
        E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
        
        if E is None:
            print(f"  Warning: Could not estimate essential matrix for images {i} and {i+1}")
            camera_poses.append(np.eye(4))
            continue
        
        # Recover pose
        _, R, t, mask = cv2.recoverPose(E, pts1, pts2, K)
        
        # Triangulate points to get 3D structure
        proj_matrix1 = K @ np.eye(3, 4)
        proj_matrix2 = K @ np.hstack([R, t])
        
        points_4d = cv2.triangulatePoints(proj_matrix1, proj_matrix2, pts1.T, pts2.T)
        points_3d_homo = points_4d / points_4d[3]
        
        # Transform to world coordinates
        current_pose = camera_poses[-1]
        for j in range(points_3d_homo.shape[1]):
            if mask[j]:
                point_3d = points_3d_homo[:3, j]
                # Transform to world coordinates
                world_point = current_pose[:3, :3] @ point_3d + current_pose[:3, 3]
                
                # Filter out points too far from camera (likely noise)
                distance = np.linalg.norm(world_point)
                if distance < 10:  # Only keep points within 10 units
                    points_3d.append(world_point)
                    # Assign random color for now (could extract from image)
                    point_colors.append([100, 150, 200])
        
        # Create 4x4 transformation matrix
        pose = np.eye(4)
        pose[:3, :3] = R
        pose[:3, 3] = t.flatten()
        
        # Accumulate transformation
        pose = camera_poses[-1] @ pose
        camera_poses.append(pose)
        
        print(f"  Camera {i+1}: Position = {pose[:3, 3]}, Generated {np.sum(mask)} 3D points")
    
    return camera_poses, K, np.array(points_3d), np.array(point_colors)

def save_results(image_paths, camera_poses, K, points_3d, point_colors, output_dir):
    """Save camera poses and metadata"""
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Save camera poses in format compatible with viewer
    results = {
        "camera_intrinsics": {
            "fx": float(K[0, 0]),
            "fy": float(K[1, 1]),
            "cx": float(K[0, 2]),
            "cy": float(K[1, 2])
        },
        "images": [],
        "points_3d": points_3d.tolist() if len(points_3d) > 0 else [],
        "point_colors": point_colors.tolist() if len(point_colors) > 0 else []
    }
    
    for i, (img_path, pose) in enumerate(zip(image_paths, camera_poses)):
        results["images"].append({
            "image_id": i,
            "name": img_path.name,
            "camera_pose": pose.tolist(),
            "position": pose[:3, 3].tolist(),
            "rotation_matrix": pose[:3, :3].tolist()
        })
    
    output_file = output_dir / "camera_poses.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nSaved results to {output_file}")
    return output_file

def main():
    # Get images
    images_dir = Path("colmap_workspace/images")
    if not images_dir.exists():
        images_dir = Path("src/2D_images")
    
    image_paths = sorted(images_dir.glob("*.png"))
    
    if len(image_paths) < 2:
        print(f"Error: Need at least 2 images, found {len(image_paths)}")
        return
    
    print(f"Found {len(image_paths)} images")
    
    # Load first image to get dimensions
    first_img = cv2.imread(str(image_paths[0]))
    if first_img is None:
        print(f"Error: Could not read first image {image_paths[0]}")
        return
    
    # Extract and match features
    keypoints, descriptors = extract_features(image_paths)
    matches = match_features(descriptors)
    
    # Estimate camera poses and reconstruct 3D points
    camera_poses, K, points_3d, point_colors = estimate_camera_poses(keypoints, matches, first_img.shape)
    
    # Save results
    output_file = save_results(image_paths, camera_poses, K, points_3d, point_colors, "sfm_output")
    
    print("\n" + "="*50)
    print("Structure from Motion complete!")
    print("="*50)
    print(f"\nProcessed {len(image_paths)} images")
    print(f"Estimated {len(camera_poses)} camera poses")
    print(f"Reconstructed {len(points_3d)} 3D points")
    print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main()
