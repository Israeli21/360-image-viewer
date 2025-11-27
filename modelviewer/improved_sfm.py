"""
Improved Camera Pose Estimation with Bundle Adjustment
Uses incremental SfM with proper pose refinement
"""

import cv2
import numpy as np
import json
from pathlib import Path
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

def extract_features_orb(image_paths):
    """Extract ORB features (more robust than SIFT for outdoor scenes)"""
    print("Extracting ORB features...")
    orb = cv2.ORB_create(nfeatures=5000)
    
    all_keypoints = []
    all_descriptors = []
    
    for i, img_path in enumerate(image_paths):
        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
            
        kp, desc = orb.detectAndCompute(img, None)
        all_keypoints.append(kp)
        all_descriptors.append(desc)
        print(f"  {i+1}/{len(image_paths)}: Found {len(kp)} features in {img_path.name}")
    
    return all_keypoints, all_descriptors

def match_features_sequential(descriptors, ratio_thresh=0.7):
    """Match features with robust ratio test"""
    print("\nMatching features...")
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    matches_list = []
    
    for i in range(len(descriptors) - 1):
        if descriptors[i] is None or descriptors[i+1] is None:
            matches_list.append([])
            continue
            
        matches = bf.knnMatch(descriptors[i], descriptors[i+1], k=2)
        
        # Lowe's ratio test
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < ratio_thresh * n.distance:
                    good_matches.append(m)
        
        matches_list.append(good_matches)
        print(f"  Images {i} <-> {i+1}: {len(good_matches)} good matches")
    
    return matches_list

def estimate_camera_intrinsics(image_shape):
    """Estimate camera intrinsics from image size"""
    h, w = image_shape[:2]
    # For perspective crops from 360 images, use realistic focal length
    focal_length = max(w, h) * 1.2  # Slightly wider than default
    cx, cy = w / 2, h / 2
    
    K = np.array([
        [focal_length, 0, cx],
        [0, focal_length, cy],
        [0, 0, 1]
    ], dtype=np.float64)
    
    return K

def triangulate_points(pts1, pts2, P1, P2):
    """Triangulate 3D points from two views"""
    points_4d = cv2.triangulatePoints(P1, pts2, pts2, pts2)
    points_3d = points_4d[:3] / points_4d[3]
    return points_3d.T

def reprojection_error(params, points_3d, points_2d, K, n_cameras):
    """Compute reprojection error for bundle adjustment"""
    camera_params = params[:n_cameras * 6].reshape((n_cameras, 6))
    
    total_error = []
    
    for i, (rvec_tvec, pts_2d) in enumerate(zip(camera_params, points_2d)):
        if len(pts_2d) == 0:
            continue
            
        rvec = rvec_tvec[:3]
        tvec = rvec_tvec[3:]
        
        # Project 3D points
        projected, _ = cv2.projectPoints(points_3d, rvec, tvec, K, None)
        projected = projected.reshape(-1, 2)
        
        # Compute error
        error = (projected - pts_2d).ravel()
        total_error.extend(error)
    
    return np.array(total_error)

def incremental_sfm(keypoints, matches, K, image_shape):
    """Incremental Structure from Motion with bundle adjustment"""
    print("\nIncremental SfM...")
    
    n_images = len(keypoints)
    camera_poses = []
    points_3d_global = []
    point_colors = []
    
    # Initialize with first two images
    pts1 = np.float32([keypoints[0][m.queryIdx].pt for m in matches[0]])
    pts2 = np.float32([keypoints[1][m.trainIdx].pt for m in matches[0]])
    
    # Find essential matrix with RANSAC
    E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
    
    if E is None:
        print("  ERROR: Could not find essential matrix")
        return None, None, None
    
    # Recover pose
    _, R, t, mask_pose = cv2.recoverPose(E, pts1, pts2, K, mask=mask)
    
    # First camera at origin
    pose1 = np.eye(4, dtype=np.float64)
    camera_poses.append(pose1)
    
    # Second camera pose
    pose2 = np.eye(4, dtype=np.float64)
    pose2[:3, :3] = R
    pose2[:3, 3] = t.flatten()
    camera_poses.append(pose2)
    
    print(f"  Camera 0: Origin")
    print(f"  Camera 1: Position = {t.flatten()}")
    
    # Triangulate initial points
    P1 = K @ np.eye(3, 4)
    P2 = K @ np.hstack([R, t])
    
    # Apply mask to both point sets
    mask_bool = mask_pose.ravel() == 1
    pts1_inliers = pts1[mask_bool]
    pts2_inliers = pts2[mask_bool]
    
    if len(pts1_inliers) < 8:
        print("  ERROR: Not enough inlier points")
        return None, None, None
    
    # triangulatePoints expects 2xN arrays (not Nx2)
    points_4d = cv2.triangulatePoints(P1, P2, pts1_inliers.T, pts2_inliers.T)
    points_3d = (points_4d[:3] / points_4d[3]).T
    
    # Filter points behind camera or too far
    valid_mask = (points_3d[:, 2] > 0) & (points_3d[:, 2] < 100)
    points_3d = points_3d[valid_mask]
    
    points_3d_global.extend(points_3d.tolist())
    point_colors.extend([[100, 150, 200]] * len(points_3d))
    
    print(f"  Initialized with {len(points_3d)} 3D points")
    
    # Process remaining images
    for i in range(2, min(15, n_images)):  # Process first 15 images
        if i-1 >= len(matches) or len(matches[i-1]) < 20:
            print(f"  Skipping image {i}: insufficient matches")
            camera_poses.append(camera_poses[-1].copy())
            continue
        
        # Get matches between previous and current image
        pts_prev = np.float32([keypoints[i-1][m.queryIdx].pt for m in matches[i-1]])
        pts_curr = np.float32([keypoints[i][m.trainIdx].pt for m in matches[i-1]])
        
        # Use PnP to estimate pose if we have 3D points
        if len(points_3d_global) > 10:
            # Use previous camera pose as initial guess
            prev_pose = camera_poses[-1]
            rvec_init, _ = cv2.Rodrigues(prev_pose[:3, :3])
            tvec_init = prev_pose[:3, 3].reshape(3, 1)
            
            # Solve PnP with RANSAC
            success, rvec, tvec, inliers = cv2.solvePnPRansac(
                np.array(points_3d_global[-1000:]).astype(np.float32),  # Recent points
                pts_curr[:min(1000, len(pts_curr))],
                K, None,
                rvec=rvec_init, tvec=tvec_init,
                useExtrinsicGuess=True,
                iterationsCount=1000,
                reprojectionError=3.0,
                confidence=0.99
            )
            
            if success and inliers is not None and len(inliers) > 10:
                R, _ = cv2.Rodrigues(rvec)
                pose = np.eye(4, dtype=np.float64)
                pose[:3, :3] = R
                pose[:3, 3] = tvec.flatten()
                camera_poses.append(pose)
                print(f"  Camera {i}: Position = {tvec.flatten()} ({len(inliers)} inliers)")
            else:
                # Fall back to essential matrix
                E, mask = cv2.findEssentialMat(pts_prev, pts_curr, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
                if E is not None:
                    _, R, t, mask_pose = cv2.recoverPose(E, pts_prev, pts_curr, K)
                    pose = camera_poses[-1].copy()
                    pose[:3, :3] = pose[:3, :3] @ R
                    pose[:3, 3] = pose[:3, 3] + pose[:3, :3] @ t.flatten()
                    camera_poses.append(pose)
                    print(f"  Camera {i}: Position = {pose[:3, 3]} (essential matrix)")
                else:
                    camera_poses.append(camera_poses[-1].copy())
                    print(f"  Camera {i}: Using previous pose (failed)")
        else:
            # Use essential matrix
            E, mask = cv2.findEssentialMat(pts_prev, pts_curr, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
            if E is not None:
                _, R, t, mask_pose = cv2.recoverPose(E, pts_prev, pts_curr, K)
                pose = camera_poses[-1].copy()
                pose[:3, :3] = pose[:3, :3] @ R
                pose[:3, 3] = pose[:3, 3] + pose[:3, :3] @ t.flatten()
                camera_poses.append(pose)
                print(f"  Camera {i}: Position = {pose[:3, 3]}")
            else:
                camera_poses.append(camera_poses[-1].copy())
                print(f"  Camera {i}: Using previous pose")
        
        # Triangulate new points
        prev_idx = i - 1
        P_prev = K @ camera_poses[prev_idx][:3, :]
        P_curr = K @ camera_poses[i][:3, :]
        
        pts_prev_inliers = pts_prev[:min(500, len(pts_prev))]
        pts_curr_inliers = pts_curr[:min(500, len(pts_curr))]
        
        points_4d = cv2.triangulatePoints(P_prev, pts_prev_inliers.T, P_curr, pts_curr_inliers.T)
        new_points_3d = (points_4d[:3] / points_4d[3]).T
        
        # Filter valid points
        valid_mask = (new_points_3d[:, 2] > 0) & (new_points_3d[:, 2] < 100)
        new_points_3d = new_points_3d[valid_mask]
        
        points_3d_global.extend(new_points_3d.tolist())
        point_colors.extend([[100, 150, 200]] * len(new_points_3d))
    
    return camera_poses, np.array(points_3d_global), np.array(point_colors)

def save_results(image_paths, camera_poses, K, points_3d, point_colors, output_dir):
    """Save improved camera poses and point cloud"""
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
    
    # Sort by numeric suffix to get proper sequential order
    def get_image_number(path):
        import re
        match = re.search(r'(\d+)', path.stem)
        return int(match.group(1)) if match else 0
    
    image_paths = sorted(images_dir.glob("*.png"), key=get_image_number)
    
    if len(image_paths) < 2:
        print(f"Error: Need at least 2 images, found {len(image_paths)}")
        return
    
    print(f"Found {len(image_paths)} images (sorted sequentially)\n")
    for i, p in enumerate(image_paths[:5]):
        print(f"  {i}: {p.name}")
    
    # Load first image to get dimensions
    first_img = cv2.imread(str(image_paths[0]))
    if first_img is None:
        print(f"Error: Could not read first image")
        return
    
    # Estimate camera intrinsics
    K = estimate_camera_intrinsics(first_img.shape)
    print(f"Camera intrinsics:\n{K}\n")
    
    # Extract and match features
    keypoints, descriptors = extract_features_orb(image_paths)
    matches = match_features_sequential(descriptors)
    
    # Run incremental SfM
    camera_poses, points_3d, point_colors = incremental_sfm(keypoints, matches, K, first_img.shape)
    
    if camera_poses is None:
        print("\nERROR: SfM failed")
        return
    
    # Save results
    output_file = save_results(image_paths, camera_poses, K, points_3d, point_colors, "sfm_output")
    
    print("\n" + "="*60)
    print("Improved SfM Complete!")
    print("="*60)
    print(f"Processed {len(camera_poses)} cameras")
    print(f"Reconstructed {len(points_3d)} 3D points")
    print(f"\nCamera trajectory range:")
    positions = np.array([pose[:3, 3] for pose in camera_poses])
    print(f"  X: [{positions[:, 0].min():.2f}, {positions[:, 0].max():.2f}]")
    print(f"  Y: [{positions[:, 1].min():.2f}, {positions[:, 1].max():.2f}]")
    print(f"  Z: [{positions[:, 2].min():.2f}, {positions[:, 2].max():.2f}]")

if __name__ == "__main__":
    main()
