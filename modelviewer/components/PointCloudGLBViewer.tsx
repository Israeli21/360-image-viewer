import React, { useState, useEffect } from 'react';
import { GLBViewer } from './GLBViewer';

export const PointCloudGLBViewer: React.FC = () => {
  const [glbPath, setGlbPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPointCloud = async () => {
      try {
        // Use absolute path to the point cloud file
        const fullPath = 'C:/Users/isrtr/OneDrive/Desktop/Programming/Street_Viewer/modelviewer/src/public/point_cloud.glb';
        setGlbPath(fullPath);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load point cloud:', error);
        setLoading(false);
      }
    };

    loadPointCloud();
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading point cloud...</div>
      </div>
    );
  }

  if (!glbPath) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Failed to load point cloud</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">Building Point Cloud</h1>
        <p className="text-sm text-gray-400 mt-1">
          10,893 3D points reconstructed from 28 images
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Controls: Left-click drag to rotate, Right-click drag to pan, Scroll to zoom
        </p>
      </div>

      {/* Viewer */}
      <div className="flex-1">
        <GLBViewer glbPath={glbPath} />
      </div>
    </div>
  );
};

export default PointCloudGLBViewer;
