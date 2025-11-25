/**
 * SLAM Data Adapter
 * 
 * Converts VGGT-SLAM output to the format used by the 360° viewer UI.
 */

import type { SLAMFrame, SLAMOutput, ViewpointData } from '../types/slam';
import { quaternionFromArray, quaternionToEulerDegrees } from './quaternion';

/**
 * Convert a single SLAM frame to ViewpointData
 */
export function convertSLAMFrameToViewpoint(frame: SLAMFrame): ViewpointData {
  const quaternion = quaternionFromArray(frame.quaternion);
  const euler = quaternionToEulerDegrees(quaternion);

  return {
    position: {
      x: frame.position[0],
      y: frame.position[1],
      z: frame.position[2]
    },
    angle: euler.yaw,      // Horizontal rotation (longitude)
    lat: euler.pitch,      // Vertical rotation (latitude)
    roll: euler.roll,      // Optional roll
    id: frame.id,
    timestamp: frame.timestamp
  };
}

/**
 * Convert full SLAM output to array of ViewpointData
 */
export function convertSLAMToViewpoints(slamOutput: SLAMOutput): ViewpointData[] {
  return slamOutput.frames.map(frame => convertSLAMFrameToViewpoint(frame));
}

/**
 * Load SLAM data from JSON file
 */
export async function loadSLAMData(filePath: string): Promise<SLAMOutput> {
  const response = await fetch(filePath);
  
  if (!response.ok) {
    throw new Error(`Failed to load SLAM data: ${response.statusText}`);
  }

  const data = await response.json();
  return data as SLAMOutput;
}

/**
 * Parse TUM format SLAM data
 * Format: timestamp tx ty tz qx qy qz qw
 */
export function parseTUMFormat(tumText: string): SLAMFrame[] {
  const lines = tumText.split('\n').filter(line => 
    line.trim() && !line.startsWith('#')
  );

  return lines.map((line, index) => {
    const parts = line.trim().split(/\s+/).map(Number);
    
    if (parts.length !== 8) {
      throw new Error(`Invalid TUM format at line ${index + 1}`);
    }

    const [timestamp, tx, ty, tz, qx, qy, qz, qw] = parts;

    return {
      id: index,
      timestamp,
      image: `frame_${index.toString().padStart(6, '0')}.jpg`,
      position: [tx, ty, tz],
      quaternion: [qx, qy, qz, qw]
    };
  });
}

/**
 * Generate mock SLAM data for testing
 */
export function generateMockSLAMData(
  positions: Array<[number, number, number]>,
  imageNames: string[]
): SLAMOutput {
  const frames: SLAMFrame[] = positions.map((pos, index) => ({
    id: index,
    timestamp: Date.now() + index * 1000,
    image: imageNames[index] || `image_${index}.jpg`,
    position: pos,
    quaternion: [0, 0, 0, 1], // Identity quaternion (no rotation)
    confidence: 1.0
  }));

  return {
    metadata: {
      version: '1.0',
      coordinate_system: 'world',
      unit: 'meters',
      frames_count: frames.length
    },
    frames
  };
}

/**
 * Sort viewpoints by timestamp (useful for sequential playback)
 */
export function sortViewpointsByTime(viewpoints: ViewpointData[]): ViewpointData[] {
  return [...viewpoints].sort((a, b) => 
    (a.timestamp || 0) - (b.timestamp || 0)
  );
}

/**
 * Find nearest viewpoint to a given position
 */
export function findNearestViewpoint(
  target: { x: number; y: number; z: number },
  viewpoints: ViewpointData[]
): ViewpointData | null {
  if (viewpoints.length === 0) return null;

  let nearest = viewpoints[0];
  let minDistance = Infinity;

  for (const vp of viewpoints) {
    const dx = vp.position.x - target.x;
    const dy = vp.position.y - target.y;
    const dz = vp.position.z - target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = vp;
    }
  }

  return nearest;
}
