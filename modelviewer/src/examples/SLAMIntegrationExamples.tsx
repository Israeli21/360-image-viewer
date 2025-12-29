/**
 * Example: How to use VGGT-SLAM with your 360° viewer
 * 
 * This file shows three integration approaches:
 * 1. Static SLAM data (load once from file)
 * 2. Mock SLAM data (for testing without actual SLAM)
 * 3. Real-time SLAM updates (future implementation)
 */

import React, { useState, useEffect } from 'react';
import { Enhanced360Viewer } from '../../components/Enhanced360Viewer';
import { 
  loadSLAMData, 
  convertSLAMToViewpoints,
  convertSLAMFrameToViewpoint,
  generateMockSLAMData 
} from '../utils/slamAdapter';
import type { ViewpointData } from '../types/slam';

// ========================================
// APPROACH 1: Load Static SLAM Data
// ========================================
export const SLAMViewerStatic: React.FC = () => {
  const [viewpoints, setViewpoints] = useState<ViewpointData[]>([]);
  const [images360, setImages360] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load SLAM output (get this file from VGGT-SLAM)
        const slamData = await loadSLAMData('/slam_output.json');
        
        // Convert to viewpoint format
        const viewpointData = convertSLAMToViewpoints(slamData);
        setViewpoints(viewpointData);
        
        // Load corresponding images
        const imagePaths = slamData.frames.map(frame => 
          `/images/${frame.image}`
        );
        setImages360(imagePaths);
        
        console.log('Loaded SLAM data:', {
          frames: slamData.frames.length,
          viewpoints: viewpointData.length
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load SLAM data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <Enhanced360Viewer
      glbPath="/models/scene.glb"
      images360={images360}
      viewpoints={viewpoints}
      modelCenter={{ x: 0, y: 0, z: 0 }}
    />
  );
};

// ========================================
// APPROACH 2: Mock SLAM Data (For Testing)
// ========================================
export const SLAMViewerMock: React.FC = () => {
  const [viewpoints, setViewpoints] = useState<ViewpointData[]>([]);
  const [images360, setImages360] = useState<string[]>([]);

  useEffect(() => {
    // Your current known positions
    const positions: Array<[number, number, number]> = [
      [110, 0, 30],   // IMG_2955
      [90, 0, 30],    // IMG_2958
      [65, 0, 25],    // IMG_2960
      [50, 0, 30],    // IMG_2956
      [20, 0, 60],    // IMG_2957
      [0, 0, 80],     // IMG_2959
      [0, 0, 100]     // IMG_2961
    ];

    const imageNames = [
      'CAM_1.JPG',
      'CAM_4.JPG',
      'CAM_6.JPG',
      'CAM_2.JPG',
      'CAM_3.JPG',
      'CAM_5.JPG',
      'CAM_7.JPG'
    ];

    // Generate mock SLAM data
    const mockSLAM = generateMockSLAMData(positions, imageNames);
    
    // Convert to viewpoints
    const viewpointData = convertSLAMToViewpoints(mockSLAM);
    setViewpoints(viewpointData);

    // Load images
    const imagePaths = imageNames.map(name => `/images/${name}`);
    setImages360(imagePaths);

    console.log('Generated mock SLAM data:', viewpointData);
  }, []);

  return (
    <Enhanced360Viewer
      glbPath={null}
      images360={images360}
      viewpoints={viewpoints}
      modelCenter={{ x: 0, y: 0, z: 0 }}
    />
  );
};

// ========================================
// APPROACH 3: Real-time SLAM Updates
// ========================================
export const SLAMViewerRealtime: React.FC = () => {
  const [viewpoints, setViewpoints] = useState<ViewpointData[]>([]);
  const [images360, setImages360] = useState<string[]>([]);

  useEffect(() => {
    // Connect to SLAM streaming endpoint
    // This could be WebSocket, Server-Sent Events, or polling
    
    const eventSource = new EventSource('/api/slam/stream');

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      switch (update.type) {
        case 'new_frame':
          // Add new viewpoint
          handleNewFrame(update.data);
          break;
          
        case 'pose_update':
          // Update existing viewpoint position
          handlePoseUpdate(update.data);
          break;
          
        case 'loop_closure':
          // Handle loop closure optimization
          handleLoopClosure(update.data);
          break;
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleNewFrame = (frameData: any) => {
    // Convert and add new viewpoint
    setViewpoints(prev => [...prev, convertSLAMFrameToViewpoint(frameData)]);
    setImages360(prev => [...prev, `/images/${frameData.image}`]);
  };

  const handlePoseUpdate = (frameData: any) => {
    // Update existing viewpoint
    setViewpoints(prev => 
      prev.map(vp => 
        vp.id === frameData.id 
          ? convertSLAMFrameToViewpoint(frameData)
          : vp
      )
    );
  };

  const handleLoopClosure = (optimizationData: any) => {
    // Re-load all viewpoints after global optimization
    const updatedViewpoints = convertSLAMToViewpoints(optimizationData);
    setViewpoints(updatedViewpoints);
  };

  return (
    <Enhanced360Viewer
      glbPath="/models/scene.glb"
      images360={images360}
      viewpoints={viewpoints}
      modelCenter={{ x: 0, y: 0, z: 0 }}
    />
  );
};

// ========================================
// Helper: Drop-in Replacement Function
// ========================================

/**
 * Use this to replace your current manual position loading
 */
export async function loadViewpointsFromSLAM(
  slamFilePath: string
): Promise<{
  viewpoints: ViewpointData[];
  imagePaths: string[];
}> {
  const slamData = await loadSLAMData(slamFilePath);
  const viewpoints = convertSLAMToViewpoints(slamData);
  const imagePaths = slamData.frames.map(f => `/images/${f.image}`);
  
  return { viewpoints, imagePaths };
}

// Usage in your StreetViewerDemo.tsx:
/*
useEffect(() => {
  const loadData = async () => {
    try {
      const { viewpoints, imagePaths } = await loadViewpointsFromSLAM('/slam_output.json');
      setViewpoints(viewpoints);
      setImages360(imagePaths);
    } catch (error) {
      console.error('Failed to load SLAM data:', error);
      // Fallback to manual positions
    }
  };
  loadData();
}, []);
*/
