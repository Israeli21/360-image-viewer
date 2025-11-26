import React, { useState, useEffect } from 'react';
import { Enhanced360Viewer } from '../components/Enhanced360Viewer';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Compass, Eye, EyeOff } from 'lucide-react';
import imagePositions from '../imagePositions.json';

/**
 * 360° Image Viewer Demo
 * 
 * Simple viewer for navigating through 360° panoramic images
 */

interface ImagePosition {
  x: number;
  z: number;
  name: string;
}

export const StreetViewerDemo: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [images360, setImages360] = useState<string[]>([]);
  const [viewpoints, setViewpoints] = useState<Array<{ position: { x: number; y: number; z: number }; angle: number }>>([]);
  const [hideUI, setHideUI] = useState(false);

  // Auto-load 360° images from the images folder on mount
  useEffect(() => {
    const load360Images = async () => {
      try {
        setIsLoading(true);
        // Image files in progressive path order: rightmost to left-bottom
        // Path: (110,30) → (90,30) → (65,25) → (50,30) → (20,60) → (0,80) → (0,100)
        // With custom camera angles to focus on the building
        const imageFiles = [
          'IMG_2955.JPG',  // Position 1: (110, 30) - rightmost
          'IMG_2958.JPG',  // Position 4: (90, 30)
          'IMG_2960.JPG',  // Position 6: (65, 25)
          'IMG_2956.JPG',  // Position 2: (50, 30)
          'IMG_2957.JPG',  // Position 3: (20, 60)
          'IMG_2959.JPG',  // Position 5: (0, 80)
          'IMG_2961.JPG'   // Position 7: (0, 100) - left-bottom
        ];

        // Custom camera angles for each position to face the building
        const cameraAngles = [
          { lon: -184.3, lat: 8.8 },   // Camera 1
          { lon: -166.2, lat: 13.4 },   // Camera 4
          { lon: -154.4, lat: 10.6 },  // Camera 6
          { lon: -174.8, lat: 1.2 },  // Camera 2
          { lon: -200.0, lat: 4.8 },  // Camera 3
          { lon: -204.8, lat: 12.8 },   // Camera 5
          { lon: -185.4, lat: 15.2 }   // Camera 7
        ];

        // Convert to absolute paths
        // In Electron, we need to use the correct path format
        const imagePaths = imageFiles.map(file => 
          `${window.location.origin}/images/${file}`
        );

        console.log('Window origin:', window.location.origin);
        console.log('Loading 360 images from:', imagePaths);
        
        // Test first image accessibility
        fetch(imagePaths[0])
          .then(res => console.log('First image accessible:', res.ok, res.status))
          .catch(err => console.error('Cannot access first image:', err));

        setImages360(imagePaths);

        // Load viewpoints from positions file
        const positions: Record<string, ImagePosition> = imagePositions as any;
        const viewpointData = imageFiles.map((fileName, index) => {
          const pos = positions[fileName];
          return {
            position: { x: pos.x, y: 0, z: pos.z },
            angle: cameraAngles[index].lon, // Custom horizontal angle
            lat: cameraAngles[index].lat    // Custom vertical angle
          };
        });
        
        setViewpoints(viewpointData);
        console.log('Loaded viewpoints:', viewpointData);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading 360 images:', error);
        setIsLoading(false);
      }
    };

    load360Images();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Compass className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">360° Image Viewer</h1>
              <p className="text-xs text-muted-foreground">
                Navigate through 360° panoramic images
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hide UI Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideUI(!hideUI)}
            className="gap-2"
          >
            {hideUI ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hideUI ? 'Show UI' : 'Hide UI'}
          </Button>
          
          {/* Stats */}
          {images360.length > 0 && (
            <Badge variant="outline">
              {images360.length} images
            </Badge>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 360° Viewer */}
        <div className="flex-1">
          {!isLoading && images360.length > 0 ? (
            <Enhanced360Viewer
              glbPath={null}
              images360={images360}
              viewpoints={viewpoints}
              modelCenter={{ x: 0, y: 0, z: 0 }}
              cameraDistance={5}
              hideUI={hideUI}
            />
          ) : (
            <Card className="w-full h-full flex items-center justify-center">
              <CardContent className="text-center space-y-4 pt-6">
                <Compass className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {isLoading ? 'Loading 360° Images...' : 'No Images Found'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isLoading 
                      ? 'Loading images from the images folder'
                      : 'Place 360° images in the images folder'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t p-2 text-center text-xs text-muted-foreground">
        <p>360° Spherical Panorama • Click arrows to navigate between images</p>
      </footer>
    </div>
  );
};
