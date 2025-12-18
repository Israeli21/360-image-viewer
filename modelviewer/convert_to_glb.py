"""
Convert PLY point cloud to GLB format for viewing in the modelviewer app
"""
import json
import struct
import os

def ply_to_gltf(ply_file, glb_file):
    """Convert PLY point cloud to GLB format"""
    
    print(f"Loading point cloud from {ply_file}...")
    
    # Read the PLY file
    with open(ply_file, 'rb') as f:
        # Skip ASCII header
        line = f.readline().decode('ascii')
        while not line.startswith('end_header'):
            if line.startswith('element vertex'):
                num_points = int(line.split()[-1])
            line = f.readline().decode('ascii')
        
        print(f"Reading {num_points} points...")
        
        # Read binary point data
        vertices = []
        colors = []
        
        for i in range(num_points):
            data = f.read(15)  # 3 floats (12 bytes) + 3 uchars (3 bytes)
            x, y, z, r, g, b = struct.unpack('fffBBB', data)
            vertices.extend([x, y, z])
            colors.extend([r/255.0, g/255.0, b/255.0])  # Normalize to 0-1
    
    print(f"Creating GLB file...")
    
    # Create minimal glTF structure
    gltf = {
        "asset": {"version": "2.0", "generator": "Custom COLMAP Exporter"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "COLOR_0": 1
                },
                "mode": 0  # POINTS mode
            }]
        }],
        "accessors": [
            {  # Position accessor
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": num_points,
                "type": "VEC3",
                "max": [max(vertices[i::3]) for i in range(3)],
                "min": [min(vertices[i::3]) for i in range(3)]
            },
            {  # Color accessor
                "bufferView": 1,
                "componentType": 5126,  # FLOAT
                "count": num_points,
                "type": "VEC3"
            }
        ],
        "bufferViews": [
            {  # Position buffer view
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": num_points * 12,  # 3 floats * 4 bytes
                "target": 34962  # ARRAY_BUFFER
            },
            {  # Color buffer view
                "buffer": 0,
                "byteOffset": num_points * 12,
                "byteLength": num_points * 12,
                "target": 34962
            }
        ],
        "buffers": [{
            "byteLength": num_points * 24  # Total: positions + colors
        }]
    }
    
    # Convert to binary
    json_str = json.dumps(gltf, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    json_padding = (4 - len(json_bytes) % 4) % 4
    json_bytes += b' ' * json_padding
    
    # Pack vertex data
    vertex_data = struct.pack(f'{len(vertices)}f', *vertices)
    color_data = struct.pack(f'{len(colors)}f', *colors)
    bin_data = vertex_data + color_data
    bin_padding = (4 - len(bin_data) % 4) % 4
    bin_data += b'\x00' * bin_padding
    
    # Write GLB file
    with open(glb_file, 'wb') as f:
        # GLB header
        f.write(struct.pack('<I', 0x46546C67))  # Magic: "glTF"
        f.write(struct.pack('<I', 2))  # Version
        f.write(struct.pack('<I', 12 + 8 + len(json_bytes) + 8 + len(bin_data)))  # Total length
        
        # JSON chunk
        f.write(struct.pack('<I', len(json_bytes)))  # Chunk length
        f.write(struct.pack('<I', 0x4E4F534A))  # Chunk type: "JSON"
        f.write(json_bytes)
        
        # Binary chunk
        f.write(struct.pack('<I', len(bin_data)))  # Chunk length
        f.write(struct.pack('<I', 0x004E4942))  # Chunk type: "BIN"
        f.write(bin_data)
    
    print(f"✅ GLB file saved to {glb_file}")
    print(f"\nPoint cloud with {num_points} points is ready to view!")
    print(f"You can now load it in your GLBViewer component")

if __name__ == "__main__":
    input_file = "sfm_output/point_cloud.ply"
    output_file = "sfm_output/point_cloud.glb"
    
    try:
        ply_to_gltf(input_file, output_file)
        
        # Also copy to public folder for easy access
        public_output = "src/public/point_cloud.glb"
        os.makedirs(os.path.dirname(public_output), exist_ok=True)
        
        import shutil
        shutil.copy(output_file, public_output)
        print(f"✅ Also copied to {public_output}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
