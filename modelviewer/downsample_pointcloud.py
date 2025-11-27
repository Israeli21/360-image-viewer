"""
Downsample point cloud to make it fast to load and visualize
"""

import json
import numpy as np
from pathlib import Path

def simple_downsample(points, colors, keep_ratio=0.05):
    """Fast random downsampling"""
    print(f"Downsampling {len(points)} points (keep {keep_ratio*100:.1f}%)...")
    
    points = np.array(points)
    colors = np.array(colors)
    
    # Random sampling
    n_points = len(points)
    n_keep = int(n_points * keep_ratio)
    
    indices = np.random.choice(n_points, n_keep, replace=False)
    
    downsampled_points = points[indices].tolist()
    downsampled_colors = colors[indices].tolist()
    
    print(f"Downsampled to {len(downsampled_points)} points")
    return downsampled_points, downsampled_colors

def main():
    print("="*60)
    print("DOWNSAMPLING POINT CLOUD FOR FAST LOADING")
    print("="*60)
    
    # Load full point cloud
    input_file = Path("sfm_output/camera_poses.json")
    print(f"\nLoading: {input_file}")
    
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    original_count = len(data.get('points_3d', []))
    print(f"Original points: {original_count:,}")
    
    if original_count == 0:
        print("No points to downsample!")
        return
    
    # Downsample - keep 10% of points (still ~130k points)
    points_downsampled, colors_downsampled = simple_downsample(
        data['points_3d'],
        data['point_colors'],
        keep_ratio=0.10
    )
    
    # Update data
    data['points_3d'] = points_downsampled
    data['point_colors'] = colors_downsampled
    
    # Save
    output_file = Path("sfm_output/camera_poses.json")
    print(f"\nSaving to: {output_file}")
    
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    # File size comparison
    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    reduction = (1 - len(points_downsampled) / original_count) * 100
    
    print(f"\nResults:")
    print(f"  Original points: {original_count:,}")
    print(f"  Downsampled points: {len(points_downsampled):,}")
    print(f"  Reduction: {reduction:.1f}%")
    print(f"  File size: {file_size_mb:.1f} MB")
    
    print("\n" + "="*60)
    print("DONE! Restart app - it should load MUCH faster now!")
    print("="*60)

if __name__ == "__main__":
    main()
