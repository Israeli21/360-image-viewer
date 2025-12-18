"""
Export point cloud from COLMAP reconstruction to PLY format
"""
import json
import struct

def export_ply(input_json, output_ply):
    """Export point cloud to PLY format"""
    
    print(f"Loading data from {input_json}...")
    with open(input_json, 'r') as f:
        data = json.load(f)
    
    points = data['points_3d']
    colors = data['point_colors']
    
    num_points = len(points)
    print(f"Exporting {num_points} points...")
    
    # Write PLY header
    with open(output_ply, 'wb') as f:
        # ASCII header
        header = f"""ply
format binary_little_endian 1.0
element vertex {num_points}
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
"""
        f.write(header.encode('ascii'))
        
        # Write binary point data
        for i in range(num_points):
            point = points[i]
            color = colors[i]
            
            # Pack: 3 floats (xyz) + 3 unsigned chars (rgb)
            data = struct.pack('fffBBB', 
                             float(point[0]), 
                             float(point[1]), 
                             float(point[2]),
                             int(color[0]), 
                             int(color[1]), 
                             int(color[2]))
            f.write(data)
    
    print(f"✅ Point cloud saved to {output_ply}")
    print(f"\nYou can view it with:")
    print(f"  - MeshLab")
    print(f"  - CloudCompare")
    print(f"  - Any 3D viewer that supports PLY files")

if __name__ == "__main__":
    input_file = "sfm_output/camera_poses.json"
    output_file = "sfm_output/point_cloud.ply"
    
    try:
        export_ply(input_file, output_file)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
