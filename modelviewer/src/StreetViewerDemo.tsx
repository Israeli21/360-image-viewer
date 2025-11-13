import React, { useState, useEffect } from 'react';
import { Enhanced360Viewer } from '../components/Enhanced360Viewer';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Compass } from 'lucide-react';

/**
 * 360° Image Viewer Demo
 * 
 * Simple viewer for navigating through 360° panoramic images
 */

export const StreetViewerDemo: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [images360, setImages360] = useState<string[]>([]);

  // Auto-load 360° images from the images folder on mount
  useEffect(() => {
    const load360Images = async () => {
      try {
        setIsLoading(true);
        // Get all image files from the images folder
        const imageFiles = [
          'IMG_2955.JPG',
          'IMG_2956.JPG',
          'IMG_2957.JPG',
          'IMG_2958.JPG',
          'IMG_2959.JPG',
          'IMG_2960.JPG',
          'IMG_2961.JPG'
        ];

        // Convert to absolute paths
        const imagePaths = imageFiles.map(file => 
          `${window.location.origin}/images/${file}`
        );

        console.log('Loading 360 images from:', imagePaths);
        setImages360(imagePaths);
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
              modelCenter={{ x: 0, y: 0, z: 0 }}
              cameraDistance={5}
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
