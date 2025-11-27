import React, { useState } from 'react';
import { PointCloudViewer } from '../components/PointCloudViewer';

export const PointCloudDemo: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<{ id: number; name: string } | null>(null);

  const handleCameraSelect = (imageId: number, imageName: string) => {
    setSelectedImage({ id: imageId, name: imageName });
    console.log(`Selected camera ${imageId}: ${imageName}`);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">3D Camera Reconstruction Viewer</h1>
        <p className="text-sm text-gray-400 mt-1">
          Structure from Motion - Visualizing camera poses from 28 images
        </p>
      </div>

      {/* Main viewer */}
      <div className="flex-1 relative">
        <PointCloudViewer 
          cameraDataPath="C:/Users/isrtr/OneDrive/Desktop/Programming/Street_Viewer/modelviewer/sfm_output/camera_poses.json"
          onCameraSelect={handleCameraSelect}
        />
      </div>

      {/* Status bar */}
      {selectedImage && (
        <div className="bg-gray-800 text-white p-3 border-t border-gray-700">
          <p className="text-sm">
            <span className="font-semibold">Selected:</span> {selectedImage.name} (ID: {selectedImage.id})
          </p>
        </div>
      )}
    </div>
  );
};

export default PointCloudDemo;
