/**
 * Quaternion Math Utilities
 * 
 * Functions for converting between quaternions and Euler angles.
 * VGGT-SLAM typically outputs quaternions, but the UI uses degrees.
 */

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface EulerAngles {
  yaw: number;   // Rotation around Y-axis (horizontal)
  pitch: number; // Rotation around X-axis (vertical)
  roll: number;  // Rotation around Z-axis
}

/**
 * Convert quaternion to Euler angles (radians)
 * Using YXZ rotation order (common in robotics/SLAM)
 */
export function quaternionToEuler(q: Quaternion): EulerAngles {
  const { x, y, z, w } = q;

  // Calculate Euler angles
  // Yaw (Y-axis rotation) - horizontal rotation
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));

  // Pitch (X-axis rotation) - vertical rotation
  const sinPitch = 2 * (w * x - y * z);
  const pitch = Math.abs(sinPitch) >= 1 
    ? Math.sign(sinPitch) * Math.PI / 2  // Handle singularity
    : Math.asin(sinPitch);

  // Roll (Z-axis rotation)
  const roll = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));

  return { yaw, pitch, roll };
}

/**
 * Convert quaternion to Euler angles in degrees
 */
export function quaternionToEulerDegrees(q: Quaternion): EulerAngles {
  const radians = quaternionToEuler(q);
  return {
    yaw: radians.yaw * 180 / Math.PI,
    pitch: radians.pitch * 180 / Math.PI,
    roll: radians.roll * 180 / Math.PI
  };
}

/**
 * Convert Euler angles (radians) to quaternion
 */
export function eulerToQuaternion(euler: EulerAngles): Quaternion {
  const { yaw, pitch, roll } = euler;

  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);
  const cp = Math.cos(pitch / 2);
  const sp = Math.sin(pitch / 2);
  const cr = Math.cos(roll / 2);
  const sr = Math.sin(roll / 2);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy
  };
}

/**
 * Normalize a quaternion
 */
export function normalizeQuaternion(q: Quaternion): Quaternion {
  const magnitude = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  
  if (magnitude === 0) {
    return { x: 0, y: 0, z: 0, w: 1 }; // Identity quaternion
  }

  return {
    x: q.x / magnitude,
    y: q.y / magnitude,
    z: q.z / magnitude,
    w: q.w / magnitude
  };
}

/**
 * Create quaternion from array [x, y, z, w]
 */
export function quaternionFromArray(arr: [number, number, number, number]): Quaternion {
  return { x: arr[0], y: arr[1], z: arr[2], w: arr[3] };
}
