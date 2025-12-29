"""
VGGT-SLAM Output Converter
This script converts VGGT-SLAM output files downloaded from Google Colab
to formats compatible with your React app.

Usage:
    1. Extract vggt_slam_output.zip from Colab
    2. Place files in modelviewer/vggt_output/
    3. Run: python convert_vggt_output.py
"""

import os
import json
import struct
import numpy as np
from pathlib import Path

# Paths
VGGT_OUTPUT_DIR = Path(__file__).parent / "vggt_output"
PUBLIC_DIR = Path(__file__).parent / "src" / "public"
PLY_FILE = VGGT_OUTPUT_DIR / "point_cloud.ply"
GLB_OUTPUT = PUBLIC_DIR / "point_cloud.glb"
CAMERA_POSES_INPUT = VGGT_OUTPUT_DIR / "camera_poses.json"
CAMERA_POSES_OUTPUT = PUBLIC_DIR / "camera_poses.json"

def read_ply(ply_path):
    """Read PLY file and extract vertices with colors"""
    print(f"📖 Reading PLY file: {ply_path}")
    
    vertices = []
    colors = []
    
    with open(ply_path, 'r') as f:
        # Read header
        line = f.readline()
        if line.strip() != 'ply':
            raise ValueError("Not a valid PLY file")
        
        num_vertices = 0
        in_header = True
        
        while in_header:
            line = f.readline().strip()
            if line.startswith('element vertex'):
                num_vertices = int(line.split()[-1])
            elif line == 'end_header':
                in_header = False
        
        # Read vertex data
        for _ in range(num_vertices):
            line = f.readline().strip().split()
            x, y, z = map(float, line[0:3])
            r, g, b = map(int, line[3:6])
            vertices.append([x, y, z])
            colors.append([r, g, b])
    
    print(f"✅ Read {len(vertices)} points from PLY")
    return np.array(vertices, dtype=np.float32), np.array(colors, dtype=np.uint8)

def create_glb(vertices, colors, output_path):
    """Create GLB file from vertices and colors"""
    print(f"🔨 Creating GLB file...")
    
    num_points = len(vertices)
    
    # Flatten arrays
    positions = vertices.flatten().tobytes()
    colors_rgb = colors.flatten().tobytes()
    
    # Create buffer
    buffer_data = positions + colors_rgb
    buffer_length = len(buffer_data)
    
    # Pad buffer to multiple of 4
    padding = (4 - (buffer_length % 4)) % 4
    buffer_data += b'\x00' * padding
    buffer_length += padding
    
    # Create accessor for positions
    positions_accessor = {
        "bufferView": 0,
        "componentType": 5126,  # FLOAT
        "count": num_points,
        "type": "VEC3",
        "max": vertices.max(axis=0).tolist(),
        "min": vertices.min(axis=0).tolist()
    }
    
    # Create accessor for colors
    colors_accessor = {
        "bufferView": 1,
        "componentType": 5121,  # UNSIGNED_BYTE
        "count": num_points,
        "type": "VEC3",
        "normalized": True
    }
    
    # Create buffer views
    buffer_views = [
        {
            "buffer": 0,
            "byteOffset": 0,
            "byteLength": len(positions),
            "target": 34962  # ARRAY_BUFFER
        },
        {
            "buffer": 0,
            "byteOffset": len(positions),
            "byteLength": len(colors_rgb),
            "target": 34962  # ARRAY_BUFFER
        }
    ]
    
    # Create mesh
    mesh = {
        "primitives": [{
            "attributes": {
                "POSITION": 0,
                "COLOR_0": 1
            },
            "mode": 0  # POINTS
        }]
    }
    
    # Create glTF JSON
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "VGGT-SLAM Converter"
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [mesh],
        "accessors": [positions_accessor, colors_accessor],
        "bufferViews": buffer_views,
        "buffers": [{
            "byteLength": buffer_length
        }]
    }
    
    # Convert JSON to bytes
    json_data = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    json_length = len(json_data)
    
    # Pad JSON to multiple of 4
    json_padding = (4 - (json_length % 4)) % 4
    json_data += b' ' * json_padding
    json_length += json_padding
    
    # Write GLB file
    with open(output_path, 'wb') as f:
        # GLB header
        f.write(struct.pack('<I', 0x46546C67))  # magic: glTF
        f.write(struct.pack('<I', 2))           # version: 2
        f.write(struct.pack('<I', 12 + 8 + json_length + 8 + buffer_length))  # total length
        
        # JSON chunk
        f.write(struct.pack('<I', json_length))  # chunk length
        f.write(struct.pack('<I', 0x4E4F534A))  # chunk type: JSON
        f.write(json_data)
        
        # Binary chunk
        f.write(struct.pack('<I', buffer_length))  # chunk length
        f.write(struct.pack('<I', 0x004E4942))    # chunk type: BIN
        f.write(buffer_data)
    
    file_size = os.path.getsize(output_path)
    print(f"✅ Created GLB file: {output_path}")
    print(f"   Size: {file_size / 1024:.2f} KB")
    print(f"   Points: {num_points:,}")

def copy_camera_poses():
    """Copy camera poses JSON if it exists"""
    if CAMERA_POSES_INPUT.exists():
        import shutil
        shutil.copy(CAMERA_POSES_INPUT, CAMERA_POSES_OUTPUT)
        print(f"✅ Copied camera poses to {CAMERA_POSES_OUTPUT}")
    else:
        print(f"⚠️ Camera poses file not found: {CAMERA_POSES_INPUT}")

def main():
    print("=" * 60)
    print("VGGT-SLAM Output Converter")
    print("=" * 60)
    
    # Check if input files exist
    if not VGGT_OUTPUT_DIR.exists():
        print(f"❌ Error: {VGGT_OUTPUT_DIR} directory not found")
        print(f"   Please extract vggt_slam_output.zip here first")
        return
    
    if not PLY_FILE.exists():
        print(f"❌ Error: {PLY_FILE} not found")
        print(f"   Make sure you downloaded the output from Colab")
        return
    
    # Create public directory if needed
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    # Convert PLY to GLB
    vertices, colors = read_ply(PLY_FILE)
    create_glb(vertices, colors, GLB_OUTPUT)
    
    # Copy camera poses
    copy_camera_poses()
    
    print("\n" + "=" * 60)
    print("✅ CONVERSION COMPLETE!")
    print("=" * 60)
    print(f"\nFiles are ready in: {PUBLIC_DIR}")
    print("You can now view the point cloud in your React app!")

if __name__ == "__main__":
    main()
