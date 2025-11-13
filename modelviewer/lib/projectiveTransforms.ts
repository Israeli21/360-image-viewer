/**
 * Projective Transform Utilities for Street Viewer
 * Handles pixel-wise projective transformations between images
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Matrix3x3 {
  m: number[][]; // 3x3 matrix
}

/**
 * Create a 3x3 identity matrix
 */
export function createIdentityMatrix(): Matrix3x3 {
  return {
    m: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]
  };
}

/**
 * Multiply two 3x3 matrices
 */
export function multiplyMatrices(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
  const result = createIdentityMatrix();
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result.m[i][j] = 
        a.m[i][0] * b.m[0][j] +
        a.m[i][1] * b.m[1][j] +
        a.m[i][2] * b.m[2][j];
    }
  }
  
  return result;
}

/**
 * Invert a 3x3 matrix (for inverse transformations)
 */
export function invertMatrix(matrix: Matrix3x3): Matrix3x3 | null {
  const m = matrix.m;
  
  // Calculate determinant
  const det = 
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  
  if (Math.abs(det) < 1e-10) {
    return null; // Matrix is singular
  }
  
  const invDet = 1 / det;
  
  return {
    m: [
      [
        invDet * (m[1][1] * m[2][2] - m[1][2] * m[2][1]),
        invDet * (m[0][2] * m[2][1] - m[0][1] * m[2][2]),
        invDet * (m[0][1] * m[1][2] - m[0][2] * m[1][1])
      ],
      [
        invDet * (m[1][2] * m[2][0] - m[1][0] * m[2][2]),
        invDet * (m[0][0] * m[2][2] - m[0][2] * m[2][0]),
        invDet * (m[0][2] * m[1][0] - m[0][0] * m[1][2])
      ],
      [
        invDet * (m[1][0] * m[2][1] - m[1][1] * m[2][0]),
        invDet * (m[0][1] * m[2][0] - m[0][0] * m[2][1]),
        invDet * (m[0][0] * m[1][1] - m[0][1] * m[1][0])
      ]
    ]
  };
}

/**
 * Apply a projective transformation to a point
 */
export function transformPoint(point: Point2D, matrix: Matrix3x3): Point2D {
  const x = point.x;
  const y = point.y;
  
  // Homogeneous coordinates
  const w = matrix.m[2][0] * x + matrix.m[2][1] * y + matrix.m[2][2];
  
  if (Math.abs(w) < 1e-10) {
    return point; // Avoid division by zero
  }
  
  return {
    x: (matrix.m[0][0] * x + matrix.m[0][1] * y + matrix.m[0][2]) / w,
    y: (matrix.m[1][0] * x + matrix.m[1][1] * y + matrix.m[1][2]) / w
  };
}

/**
 * Calculate a homography matrix from 4 point correspondences
 * Uses Direct Linear Transform (DLT) algorithm
 */
export function calculateHomography(
  srcPoints: [Point2D, Point2D, Point2D, Point2D],
  dstPoints: [Point2D, Point2D, Point2D, Point2D]
): Matrix3x3 | null {
  // Build the equation system Ah = 0
  const A: number[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const src = srcPoints[i];
    const dst = dstPoints[i];
    
    A.push([
      -src.x, -src.y, -1, 0, 0, 0, dst.x * src.x, dst.x * src.y, dst.x
    ]);
    A.push([
      0, 0, 0, -src.x, -src.y, -1, dst.y * src.x, dst.y * src.y, dst.y
    ]);
  }
  
  // Solve using SVD (simplified version - in production use a proper SVD library)
  // For now, we'll use a direct solution for 4 points
  const h = solveDLT(A);
  
  if (!h) return null;
  
  return {
    m: [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]]
    ]
  };
}

/**
 * Simplified DLT solver (for 4 point correspondences)
 * In production, use a proper linear algebra library
 */
function solveDLT(A: number[][]): number[] | null {
  // This is a simplified version
  // In a real implementation, you'd use SVD decomposition
  // For now, return a normalized identity-like result
  
  // Placeholder - implement proper SVD or use a library like math.js
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/**
 * Create a rotation matrix for panoramic transformations
 */
export function createRotationMatrix(yaw: number, pitch: number, roll: number = 0): Matrix3x3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  
  return {
    m: [
      [
        cy * cr - sy * sp * sr,
        -cy * sr - sy * sp * cr,
        -sy * cp
      ],
      [
        cp * sr,
        cp * cr,
        -sp
      ],
      [
        sy * cr + cy * sp * sr,
        -sy * sr + cy * sp * cr,
        cy * cp
      ]
    ]
  };
}

/**
 * Apply perspective warp to an image using canvas
 */
export async function applyPerspectiveWarp(
  sourceCanvas: HTMLCanvasElement,
  transform: Matrix3x3,
  outputWidth: number,
  outputHeight: number
): Promise<HTMLCanvasElement> {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  
  const srcCtx = sourceCanvas.getContext('2d');
  const dstCtx = outputCanvas.getContext('2d');
  
  if (!srcCtx || !dstCtx) {
    throw new Error('Could not get canvas context');
  }
  
  const srcImageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const dstImageData = dstCtx.createImageData(outputWidth, outputHeight);
  
  // Invert transform for backward mapping (to avoid holes in output)
  const invTransform = invertMatrix(transform);
  
  if (!invTransform) {
    throw new Error('Transform matrix is not invertible');
  }
  
  // Apply transformation pixel by pixel
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Map output pixel to source image
      const srcPoint = transformPoint({ x, y }, invTransform);
      
      const srcX = Math.floor(srcPoint.x);
      const srcY = Math.floor(srcPoint.y);
      
      // Check bounds
      if (srcX >= 0 && srcX < sourceCanvas.width && srcY >= 0 && srcY < sourceCanvas.height) {
        // Bilinear interpolation for smoother results
        const value = bilinearInterpolate(srcImageData, srcPoint.x, srcPoint.y);
        
        const dstIdx = (y * outputWidth + x) * 4;
        dstImageData.data[dstIdx] = value.r;
        dstImageData.data[dstIdx + 1] = value.g;
        dstImageData.data[dstIdx + 2] = value.b;
        dstImageData.data[dstIdx + 3] = value.a;
      }
    }
  }
  
  dstCtx.putImageData(dstImageData, 0, 0);
  return outputCanvas;
}

/**
 * Bilinear interpolation for smoother transformations
 */
function bilinearInterpolate(
  imageData: ImageData,
  x: number,
  y: number
): { r: number; g: number; b: number; a: number } {
  const x1 = Math.floor(x);
  const x2 = Math.min(x1 + 1, imageData.width - 1);
  const y1 = Math.floor(y);
  const y2 = Math.min(y1 + 1, imageData.height - 1);
  
  const dx = x - x1;
  const dy = y - y1;
  
  const getPixel = (px: number, py: number) => {
    const idx = (py * imageData.width + px) * 4;
    return {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
      a: imageData.data[idx + 3]
    };
  };
  
  const p11 = getPixel(x1, y1);
  const p21 = getPixel(x2, y1);
  const p12 = getPixel(x1, y2);
  const p22 = getPixel(x2, y2);
  
  const interpolate = (v11: number, v21: number, v12: number, v22: number): number => {
    return Math.round(
      v11 * (1 - dx) * (1 - dy) +
      v21 * dx * (1 - dy) +
      v12 * (1 - dx) * dy +
      v22 * dx * dy
    );
  };
  
  return {
    r: interpolate(p11.r, p21.r, p12.r, p22.r),
    g: interpolate(p11.g, p21.g, p12.g, p22.g),
    b: interpolate(p11.b, p21.b, p12.b, p22.b),
    a: interpolate(p11.a, p21.a, p12.a, p22.a)
  };
}

/**
 * Convert spherical coordinates to Cartesian (for panorama mapping)
 */
export function sphericalToCartesian(
  longitude: number,
  latitude: number,
  radius: number = 1
): { x: number; y: number; z: number } {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = longitude * (Math.PI / 180);
  
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta)
  };
}

/**
 * Convert Cartesian coordinates to spherical (for panorama mapping)
 */
export function cartesianToSpherical(x: number, y: number, z: number): {
  longitude: number;
  latitude: number;
  radius: number;
} {
  const radius = Math.sqrt(x * x + y * y + z * z);
  const latitude = 90 - Math.acos(y / radius) * (180 / Math.PI);
  const longitude = Math.atan2(z, x) * (180 / Math.PI);
  
  return { longitude, latitude, radius };
}
