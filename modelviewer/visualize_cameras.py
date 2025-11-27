"""
Visualize camera poses in 3D using matplotlib
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Load camera poses
with open('sfm_output/camera_poses.json', 'r') as f:
    data = json.load(f)

# Extract camera positions
positions = []
for img in data['images']:
    positions.append(img['position'])

positions = np.array(positions)

# Create 3D plot
fig = plt.figure(figsize=(12, 8))
ax = fig.add_subplot(111, projection='3d')

# Plot camera positions
ax.scatter(positions[:, 0], positions[:, 1], positions[:, 2], c='red', marker='o', s=50, label='Cameras')

# Plot camera trajectory
ax.plot(positions[:, 0], positions[:, 1], positions[:, 2], 'b-', alpha=0.5, linewidth=1)

# Add camera orientation arrows
for i, img in enumerate(data['images']):
    pos = np.array(img['position'])
    # Get forward direction from rotation matrix (third column points backward, so negate)
    R = np.array(img['rotation_matrix'])
    forward = -R[:, 2] * 0.3  # Scale for visibility
    
    ax.quiver(pos[0], pos[1], pos[2], 
             forward[0], forward[1], forward[2],
             color='green', alpha=0.6, arrow_length_ratio=0.3)

# Labels
ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Z')
ax.set_title('Camera Poses from Structure from Motion')
ax.legend()

# Equal aspect ratio
max_range = np.array([positions[:, 0].max()-positions[:, 0].min(),
                      positions[:, 1].max()-positions[:, 1].min(),
                      positions[:, 2].max()-positions[:, 2].min()]).max() / 2.0

mid_x = (positions[:, 0].max()+positions[:, 0].min()) * 0.5
mid_y = (positions[:, 1].max()+positions[:, 1].min()) * 0.5
mid_z = (positions[:, 2].max()+positions[:, 2].min()) * 0.5

ax.set_xlim(mid_x - max_range, mid_x + max_range)
ax.set_ylim(mid_y - max_range, mid_y + max_range)
ax.set_zlim(mid_z - max_range, mid_z + max_range)

plt.savefig('sfm_output/camera_trajectory.png', dpi=150, bbox_inches='tight')
print("\nSaved visualization to sfm_output/camera_trajectory.png")
plt.show()
