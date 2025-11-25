/**
 * SLAM Data Type Definitions
 * 
 * These interfaces match common SLAM output formats.
 * Adjust based on actual VGGT-SLAM output format.
 */

// TUM format SLAM frame
export interface TUMFrame {
  timestamp: number;
  tx: number;  // Translation X
  ty: number;  // Translation Y
  tz: number;  // Translation Z
  qx: number;  // Quaternion X
  qy: number;  // Quaternion Y
  qz: number;  // Quaternion Z
  qw: number;  // Quaternion W
}

// JSON format SLAM frame (more flexible)
export interface SLAMFrame {
  id: number;
  timestamp: number;
  image: string;
  position: [number, number, number];
  quaternion: [number, number, number, number]; // [x, y, z, w]
  confidence?: number; // Optional: pose confidence score
}

// SLAM output file format
export interface SLAMOutput {
  metadata: {
    version: string;
    coordinate_system: string;
    unit: string; // "meters", "centimeters", etc.
    frames_count: number;
  };
  frames: SLAMFrame[];
  point_cloud?: {
    points: Array<[number, number, number]>;
    colors?: Array<[number, number, number]>;
  };
}

// Your UI's viewpoint format
export interface ViewpointData {
  position: { x: number; y: number; z: number };
  angle: number;   // Horizontal rotation (yaw) in degrees
  lat?: number;    // Vertical rotation (pitch) in degrees
  roll?: number;   // Roll rotation in degrees (optional)
  id?: number;     // Frame ID for tracking updates
  timestamp?: number; // For temporal ordering
}

// Real-time SLAM update
export interface SLAMUpdate {
  type: 'pose_update' | 'new_frame' | 'loop_closure' | 'optimization';
  frame_id: number;
  data: SLAMFrame;
}
