"""
Robust camera pose estimation using incremental essential matrix decomposition
Focuses on getting camera positions right first, then dense reconstruction
"""

import cv2
import numpy as np
import json
from pathlib import Path

def load_and_sort_images(images_dir="src/2D_images"):
    """Load images in proper sequential order"""
    import re
    images_dir = Path(images_dir)
    
    def get_image_number(path):
        match = re.search(r'(\d+)', path.stem)
        return int(match.group(1)) if match else 0
    
    image_paths = sorted(images_dir.glob("*.png"), key=get_image_number)
    return image_paths

def estimate_camera_intrinsics(img_shape, fov_deg=90):
    """
    Estimate camera intrinsics based on field of view
    For 360 crops, we can estimate FOV from the crop angle
    """
    h, w = img_shape[:2]
    
    # For 30-degree crops from 360° image, focal length relates to FOV
    focal_length = w / (2 * np.tan(np.radians(fov_deg) / 2))
    
    K = np.array([
        [focal_length, 0, w / 2],
        [0, focal_length, h / 2],
        [0, 0, 1]
    ], dtype=np.float64)
    
    return K

def extract_and_match_features(img_paths):
    """Extract SIFT features and match between consecutive images"""
    print("Extracting features...")
    sift = cv2.SIFT_create(nfeatures=3000)
    
    images = []
    keypoints_list = []
    descriptors_list = []
    
    for i, img_path in enumerate(img_paths):
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kp, desc = sift.detectAndCompute(gray, None)
        
        images.append(img)
        keypoints_list.append(kp)
        descriptors_list.append(desc)
        print(f"  {i+1}/{len(img_paths)}: {len(kp)} features - {img_path.name}")
    
    # Match consecutive pairs
    print("\nMatching features...")
    bf = cv2.BFMatcher()
    matches_list = []
    
    for i in range(len(descriptors_list) - 1):
        matches = bf.knnMatch(descriptors_list[i], descriptors_list[i+1], k=2)
        
        # Lowe's ratio test
        good = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.75 * n.distance:
                    good.append(m)
        
        matches_list.append(good)
        print(f"  {i} <-> {i+1}: {len(good)} matches")
    
    return images, keypoints_list, descriptors_list, matches_list

def estimate_poses_essential_matrix(keypoints_list, matches_list, K):
    """
    Estimate camera poses using essential matrix for each consecutive pair
    Build up camera trajectory incrementally
    """
    print("\nEstimating camera poses...")
    
    n_images = len(keypoints_list)
    camera_poses = []
    all_points_3d = []
    all_colors = []
    
    # First camera at origin
    pose = np.eye(4, dtype=np.float64)
    camera_poses.append(pose.copy())
    print(f"  Camera 0: Origin")
    
    # Process each pair
    for i in range(len(matches_list)):
        if len(matches_list[i]) < 50:
            print(f"  Camera {i+1}: Insufficient matches, copying previous pose")
            camera_poses.append(camera_poses[-1].copy())
            continue
        
        # Get matched points
        pts1 = np.float32([keypoints_list[i][m.queryIdx].pt for m in matches_list[i]])
        pts2 = np.float32([keypoints_list[i+1][m.trainIdx].pt for m in matches_list[i]])
        
        # Find essential matrix with RANSAC
        E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
        
        if E is None or mask is None:
            print(f"  Camera {i+1}: Essential matrix failed, copying previous pose")
            camera_poses.append(camera_poses[-1].copy())
            continue
        
        # Recover relative pose
        _, R, t, mask_pose = cv2.recoverPose(E, pts1, pts2, K, mask=mask)
        
        # Get current camera pose (accumulate the transformation)
        prev_pose = camera_poses[-1]
        new_pose = np.eye(4, dtype=np.float64)
        
        # Transform: new_pose = prev_pose * [R|t]
        new_pose[:3, :3] = prev_pose[:3, :3] @ R
        new_pose[:3, 3] = prev_pose[:3, 3] + prev_pose[:3, :3] @ t.flatten()
        
        camera_poses.append(new_pose)
        
        # Calculate distance moved
        dist = np.linalg.norm(new_pose[:3, 3] - prev_pose[:3, 3])
        print(f"  Camera {i+1}: pos={new_pose[:3, 3]}, moved={dist:.3f} units")
        
        # Triangulate points for this pair
        P1 = K @ prev_pose[:3, :]
        P2 = K @ new_pose[:3, :]
        
        # Use inlier points from pose recovery
        mask_bool = mask_pose.ravel() == 1
        pts1_good = pts1[mask_bool]
        pts2_good = pts2[mask_bool]
        
        if len(pts1_good) < 10:
            continue
        
        # Triangulate
        points_4d = cv2.triangulatePoints(P1, P2, pts1_good.T, pts2_good.T)
        points_3d = (points_4d[:3] / points_4d[3]).T
        
        # Filter points behind cameras or too far
        valid = (points_3d[:, 2] > 0) & (points_3d[:, 2] < 50)
        points_3d = points_3d[valid]
        
        all_points_3d.extend(points_3d.tolist())
        all_colors.extend([[150, 150, 200]] * len(points_3d))
    
    return camera_poses, np.array(all_points_3d), np.array(all_colors)

def save_results(img_paths, camera_poses, K, points_3d, colors, output_dir="sfm_output"):
    """Save camera poses and point cloud"""
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    results = {
        "camera_intrinsics": {
            "fx": float(K[0, 0]),
            "fy": float(K[1, 1]),
            "cx": float(K[0, 2]),
            "cy": float(K[1, 2])
        },
        "images": [],
        "points_3d": points_3d.tolist() if len(points_3d) > 0 else [],
        "point_colors": colors.tolist() if len(colors) > 0 else []
    }
    
    for i, (img_path, pose) in enumerate(zip(img_paths, camera_poses)):
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
    
    print(f"\nSaved to: {output_file}")
    print(f"Cameras: {len(camera_poses)}")
    print(f"3D Points: {len(points_3d)}")
    
    # Print camera trajectory statistics
    if len(camera_poses) > 1:
        positions = np.array([pose[:3, 3] for pose in camera_poses])
        print(f"\nCamera trajectory range:")
        print(f"  X: [{positions[:, 0].min():.2f}, {positions[:, 0].max():.2f}]")
        print(f"  Y: [{positions[:, 1].min():.2f}, {positions[:, 1].max():.2f}]")
        print(f"  Z: [{positions[:, 2].min():.2f}, {positions[:, 2].max():.2f}]")
        
        # Total path length
        total_dist = sum([
            np.linalg.norm(camera_poses[i+1][:3, 3] - camera_poses[i][:3, 3])
            for i in range(len(camera_poses) - 1)
        ])
        print(f"  Total path length: {total_dist:.2f} units")

def main():
    print("="*60)
    print("ROBUST CAMERA POSE ESTIMATION")
    print("="*60)
    
    # Load images
    img_paths = load_and_sort_images()
    if len(img_paths) < 2:
        print(f"Error: Need at least 2 images")
        return
    
    print(f"\nLoaded {len(img_paths)} images")
    
    # Extract and match features
    images, keypoints, descriptors, matches = extract_and_match_features(img_paths)
    
    # Estimate intrinsics
    K = estimate_camera_intrinsics(images[0].shape)
    print(f"\nCamera intrinsics (FOV=90°):")
    print(f"  Focal length: {K[0,0]:.1f} pixels")
    print(f"  Principal point: ({K[0,2]:.1f}, {K[1,2]:.1f})")
    
    # Estimate camera poses
    poses, points_3d, colors = estimate_poses_essential_matrix(keypoints, matches, K)
    
    # Save results
    save_results(img_paths[:len(poses)], poses, K, points_3d, colors)
    
    print("\n" + "="*60)
    print("DONE! Restart the app and click the Camera icon to view.")
    print("="*60)

if __name__ == "__main__":
    main()
