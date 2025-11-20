#!/usr/bin/env python3
"""
Auto-calculate camera positions from 360° panoramic images using feature matching.
This script uses SIFT/ORB features to match between images and estimate relative positions.
"""

import cv2
import numpy as np
import json
import os
from pathlib import Path

# Configuration
IMAGES_DIR = Path(__file__).parent.parent / 'images'
OUTPUT_FILE = Path(__file__).parent.parent / 'imagePositions.json'
IMAGE_FILES = [
    'IMG_2955.JPG',
    'IMG_2956.JPG', 
    'IMG_2957.JPG',
    'IMG_2958.JPG',
    'IMG_2959.JPG',
    'IMG_2960.JPG',
    'IMG_2961.JPG'
]

def extract_features(image_path):
    """Extract SIFT features from panoramic image."""
    print(f"📸 Loading: {os.path.basename(image_path)}")
    img = cv2.imread(str(image_path))
    if img is None:
        print(f"❌ Failed to load {image_path}")
        return None, None
    
    # Downsample for faster processing (360° images are huge)
    scale = 0.25  # Use 25% of original size
    width = int(img.shape[1] * scale)
    height = int(img.shape[0] * scale)
    img = cv2.resize(img, (width, height))
    print(f"   Resized to {width}x{height}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Use SIFT detector (better for panoramic images)
    sift = cv2.SIFT_create(nfeatures=300)  # Reduced from 500
    keypoints, descriptors = sift.detectAndCompute(gray, None)
    
    print(f"   Found {len(keypoints)} features")
    return keypoints, descriptors

def match_images(desc1, desc2):
    """Match features between two images."""
    if desc1 is None or desc2 is None:
        return []
    
    # FLANN matcher for better performance
    FLANN_INDEX_KDTREE = 1
    index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
    search_params = dict(checks=50)
    flann = cv2.FlannBasedMatcher(index_params, search_params)
    
    matches = flann.knnMatch(desc1, desc2, k=2)
    
    # Lowe's ratio test
    good_matches = []
    for m_n in matches:
        if len(m_n) == 2:
            m, n = m_n
            if m.distance < 0.7 * n.distance:
                good_matches.append(m)
    
    return good_matches

def calculate_positions():
    """Calculate relative positions of all images."""
    print("\n🔍 Extracting features from all images...\n")
    
    # Extract features from all images
    features = {}
    for img_file in IMAGE_FILES:
        img_path = IMAGES_DIR / img_file
        kp, desc = extract_features(img_path)
        features[img_file] = {'keypoints': kp, 'descriptors': desc}
    
    print("\n🔗 Matching images to find connections...\n")
    
    # Build connection graph
    connections = {}
    for i, img1 in enumerate(IMAGE_FILES):
        connections[img1] = {}
        for j, img2 in enumerate(IMAGE_FILES):
            if i >= j:
                continue
            
            matches = match_images(
                features[img1]['descriptors'],
                features[img2]['descriptors']
            )
            
            if len(matches) > 20:  # Threshold for good match
                print(f"   {os.path.basename(img1)} ↔ {os.path.basename(img2)}: {len(matches)} matches")
                connections[img1][img2] = len(matches)
    
    print("\n📐 Calculating positions...\n")
    
    # Simple position estimation based on connectivity
    # Start with first image at origin
    positions = {}
    positions[IMAGE_FILES[0]] = {'x': 0, 'z': 0, 'name': 'Position 1'}
    
    # Use match counts to estimate distances
    # Images with more matches are likely closer together
    placed = {IMAGE_FILES[0]}
    scale = 30  # Average distance in feet
    
    while len(placed) < len(IMAGE_FILES):
        for img in IMAGE_FILES:
            if img in placed:
                continue
            
            # Find best connected placed image
            best_connection = None
            best_matches = 0
            
            for placed_img in placed:
                match_count = 0
                if img in connections.get(placed_img, {}):
                    match_count = connections[placed_img][img]
                elif placed_img in connections.get(img, {}):
                    match_count = connections[img][placed_img]
                
                if match_count > best_matches:
                    best_matches = match_count
                    best_connection = placed_img
            
            if best_connection and best_matches > 15:
                # Estimate distance based on match count
                # More matches = closer together
                distance = scale * (100 / max(best_matches, 20))
                
                # Place at estimated distance from connected image
                base_pos = positions[best_connection]
                angle = len(placed) * 45  # Spread out in different directions
                rad = np.radians(angle)
                
                positions[img] = {
                    'x': round(base_pos['x'] + distance * np.cos(rad), 1),
                    'z': round(base_pos['z'] + distance * np.sin(rad), 1),
                    'name': f'Position {len(placed) + 1}'
                }
                placed.add(img)
                print(f"   ✓ {os.path.basename(img)}: ({positions[img]['x']}, {positions[img]['z']}) - {best_matches} matches to {os.path.basename(best_connection)}")
    
    # Save results
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(positions, f, indent=2)
    
    print(f"\n✅ Saved positions to: {OUTPUT_FILE}\n")
    
    # Print summary
    print("📊 Summary of calculated positions:")
    for img, pos in positions.items():
        print(f"   {os.path.basename(img)}: ({pos['x']:>6}, {pos['z']:>6})")
    
    return positions

if __name__ == '__main__':
    try:
        positions = calculate_positions()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
