import json

with open('sfm_output/camera_poses.json', 'r') as f:
    data = json.load(f)

print(f"Cameras: {len(data['images'])}")
print(f"3D Points: {len(data.get('points_3d', []))}")
print(f"Point Colors: {len(data.get('point_colors', []))}")
