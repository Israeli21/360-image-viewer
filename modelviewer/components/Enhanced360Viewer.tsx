import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronLeft, ChevronRight, MapPin, Eye, EyeOff, Map as MapIcon } from 'lucide-react';

export interface Enhanced360ViewerProps {
  glbPath: string | null;
  images360: string[]; // Paths to 360° panoramic images
  modelCenter?: { x: number; y: number; z: number };
  cameraDistance?: number;
  onViewpointChange?: (index: number) => void;
}

export const Enhanced360Viewer: React.FC<Enhanced360ViewerProps> = ({
  glbPath,
  images360,
  modelCenter = { x: 0, y: 0, z: 0 },
  cameraDistance = 5,
  onViewpointChange
}) => {
  // Panorama viewer refs
  const panoramaContainerRef = useRef<HTMLDivElement>(null);
  const panoramaRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const panoramaSceneRef = useRef<THREE.Scene | null>(null);
  const panoramaCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const panoramaSphereRef = useRef<THREE.Mesh | null>(null);
  
  // Mini map refs
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const miniMapSceneRef = useRef<THREE.Scene | null>(null);
  const miniMapCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const miniMapModelRef = useRef<THREE.Group | null>(null);
  const positionMarkerRef = useRef<THREE.Mesh | null>(null);
  
  const requestRef = useRef<number | undefined>(undefined);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [rotation, setRotation] = useState({ lon: 0, lat: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStart, setMouseStart] = useState({ x: 0, y: 0 });

  // Generate viewpoint positions around the model
  const viewpoints = React.useMemo(() => {
    const numImages = images360.length;
    return images360.map((_, index) => {
      const angle = (index / numImages) * 360;
      const radian = (angle * Math.PI) / 180;
      
      return {
        position: {
          x: modelCenter.x + cameraDistance * Math.cos(radian),
          y: modelCenter.y + cameraDistance / 2,
          z: modelCenter.z + cameraDistance * Math.sin(radian)
        },
        angle
      };
    });
  }, [images360.length, modelCenter, cameraDistance]);

  // Initialize panorama viewer
  useEffect(() => {
    if (!panoramaContainerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    panoramaSceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      panoramaContainerRef.current.clientWidth / panoramaContainerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0.1);
    panoramaCameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(panoramaContainerRef.current.clientWidth, panoramaContainerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    panoramaContainerRef.current.appendChild(renderer.domElement);
    panoramaRendererRef.current = renderer;

    // Create sphere for panorama (inverted to see inside)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    panoramaSphereRef.current = sphere;

    // Handle resize
    const handleResize = () => {
      if (!panoramaContainerRef.current || !panoramaCameraRef.current || !panoramaRendererRef.current) return;
      
      const width = panoramaContainerRef.current.clientWidth;
      const height = panoramaContainerRef.current.clientHeight;
      
      panoramaCameraRef.current.aspect = width / height;
      panoramaCameraRef.current.updateProjectionMatrix();
      panoramaRendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      if (panoramaCameraRef.current && panoramaRendererRef.current && panoramaSceneRef.current) {
        // Update camera rotation based on mouse interaction
        const phi = THREE.MathUtils.degToRad(90 - rotation.lat);
        const theta = THREE.MathUtils.degToRad(rotation.lon);
        
        const target = new THREE.Vector3(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );
        
        panoramaCameraRef.current.lookAt(target);
        panoramaRendererRef.current.render(panoramaSceneRef.current, panoramaCameraRef.current);
      }

      // Render mini map
      if (miniMapRendererRef.current && miniMapSceneRef.current && miniMapCameraRef.current) {
        miniMapRendererRef.current.render(miniMapSceneRef.current, miniMapCameraRef.current);
      }
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (panoramaRendererRef.current && panoramaContainerRef.current) {
        panoramaContainerRef.current.removeChild(panoramaRendererRef.current.domElement);
        panoramaRendererRef.current.dispose();
      }
    };
  }, [rotation]);

  // Initialize mini map
  useEffect(() => {
    if (!miniMapContainerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    miniMapSceneRef.current = scene;

    // Setup orthographic camera (top-down view)
    const aspect = miniMapContainerRef.current.clientWidth / miniMapContainerRef.current.clientHeight;
    const frustumSize = 10;
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);
    miniMapCameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(miniMapContainerRef.current.clientWidth, miniMapContainerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    miniMapContainerRef.current.appendChild(renderer.domElement);
    miniMapRendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 0);
    scene.add(directionalLight);

    // Add position marker
    const markerGeometry = new THREE.ConeGeometry(0.3, 0.6, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.rotation.x = Math.PI; // Point downward
    scene.add(marker);
    positionMarkerRef.current = marker;

    // Cleanup
    return () => {
      if (miniMapRendererRef.current && miniMapContainerRef.current) {
        miniMapContainerRef.current.removeChild(miniMapRendererRef.current.domElement);
        miniMapRendererRef.current.dispose();
      }
    };
  }, []);

  // Load GLB model into mini map
  useEffect(() => {
    if (!glbPath || !miniMapSceneRef.current) return;

    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        // Remove previous model if exists
        if (miniMapModelRef.current && miniMapSceneRef.current) {
          miniMapSceneRef.current.remove(miniMapModelRef.current);
        }

        const model = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        
        model.position.set(-center.x, -center.y, -center.z);
        
        miniMapSceneRef.current?.add(model);
        miniMapModelRef.current = model;
      },
      undefined,
      (error) => {
        console.error('Error loading GLB for mini map:', error);
      }
    );
  }, [glbPath]);

  // Load current 360° image
  useEffect(() => {
    if (!panoramaSphereRef.current || !images360[currentImageIndex]) {
      console.log('No sphere or image:', { 
        hasSphere: !!panoramaSphereRef.current, 
        imageIndex: currentImageIndex,
        imagePath: images360[currentImageIndex]
      });
      return;
    }

    setIsLoading(true);
    console.log('Loading 360 image:', images360[currentImageIndex]);

    const loader = new THREE.TextureLoader();
    loader.load(
      images360[currentImageIndex],
      (texture) => {
        console.log('Texture loaded successfully!');
        texture.colorSpace = THREE.SRGBColorSpace;
        
        if (panoramaSphereRef.current?.material instanceof THREE.MeshBasicMaterial) {
          panoramaSphereRef.current.material.map = texture;
          panoramaSphereRef.current.material.needsUpdate = true;
        }
        
        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading 360 image:', images360[currentImageIndex], error);
        setIsLoading(false);
      }
    );
  }, [images360, currentImageIndex]);

  // Update position marker on mini map
  useEffect(() => {
    if (!positionMarkerRef.current || viewpoints.length === 0) return;

    const currentPos = viewpoints[currentImageIndex];
    if (currentPos) {
      positionMarkerRef.current.position.set(
        currentPos.position.x,
        2, // Height above model
        currentPos.position.z
      );
      
      // Rotate marker to face viewing direction
      positionMarkerRef.current.rotation.y = -(currentPos.angle * Math.PI / 180);
    }
  }, [currentImageIndex, viewpoints]);

  // Navigation
  const handlePrev = () => {
    const newIndex = (currentImageIndex - 1 + images360.length) % images360.length;
    setCurrentImageIndex(newIndex);
    setRotation({ lon: 0, lat: 0 }); // Reset view
    onViewpointChange?.(newIndex);
  };

  const handleNext = () => {
    const newIndex = (currentImageIndex + 1) % images360.length;
    setCurrentImageIndex(newIndex);
    setRotation({ lon: 0, lat: 0 }); // Reset view
    onViewpointChange?.(newIndex);
  };

  // Mouse controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - mouseStart.x;
    const deltaY = e.clientY - mouseStart.y;

    setRotation(prev => ({
      lon: prev.lon - deltaX * 0.2,
      lat: Math.max(-85, Math.min(85, prev.lat - deltaY * 0.2))
    }));

    setMouseStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setMouseStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - mouseStart.x;
    const deltaY = e.touches[0].clientY - mouseStart.y;

    setRotation(prev => ({
      lon: prev.lon - deltaX * 0.2,
      lat: Math.max(-85, Math.min(85, prev.lat - deltaY * 0.2))
    }));

    setMouseStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <MapPin className="h-3 w-3 mr-1" />
            Position {currentImageIndex + 1} of {images360.length}
          </Badge>
          {isLoading && <Badge variant="outline">Loading...</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMiniMap(!showMiniMap)}
          >
            {showMiniMap ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showMiniMap ? 'Hide Map' : 'Show Map'}
          </Button>
        </div>
      </div>

      {/* Main viewer area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* 360° Panorama Viewer */}
        <div className="flex-1 relative">
          <div
            ref={panoramaContainerRef}
            className="w-full h-full"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Left Arrow */}
          <Button
            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-20 w-12 rounded-full bg-background/80 hover:bg-background/90 backdrop-blur-sm shadow-lg"
            variant="ghost"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          {/* Right Arrow */}
          <Button
            className="absolute right-4 top-1/2 transform -translate-y-1/2 h-20 w-12 rounded-full bg-background/80 hover:bg-background/90 backdrop-blur-sm shadow-lg"
            variant="ghost"
            onClick={handleNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>

          {/* Position indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 bg-background/90 backdrop-blur-sm p-2 rounded-lg border shadow-lg">
            {images360.map((_, index) => (
              <Button
                key={index}
                size="sm"
                variant={index === currentImageIndex ? 'default' : 'ghost'}
                onClick={() => {
                  setCurrentImageIndex(index);
                  setRotation({ lon: 0, lat: 0 });
                  onViewpointChange?.(index);
                }}
                className="w-8 h-8 p-0"
              >
                {index + 1}
              </Button>
            ))}
          </div>

          {/* Instructions */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs shadow-lg">
            Drag to look around • Click arrows to navigate
          </div>
        </div>

        {/* Mini Map */}
        {showMiniMap && (
          <Card className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l">
            <div className="p-3 border-b bg-card/50">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Position Map</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Red marker shows your current location
              </p>
            </div>
            <div className="flex-1 relative bg-muted/20">
              <div ref={miniMapContainerRef} className="w-full h-full" />
            </div>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-card text-xs text-muted-foreground text-center">
        360° Panoramic View • {images360.length} Positions Available
      </div>
    </div>
  );
};
