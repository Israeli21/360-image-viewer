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
  viewpoints?: Array<{ position: { x: number; y: number; z: number }; angle: number }>; // Position data for each image
  modelCenter?: { x: number; y: number; z: number };
  cameraDistance?: number;
  onViewpointChange?: (index: number) => void;
}

export const Enhanced360Viewer: React.FC<Enhanced360ViewerProps> = ({
  glbPath,
  images360,
  viewpoints: providedViewpoints = [],
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
  const [showMiniMap, setShowMiniMap] = useState(true); // Show mini-map with positions
  const [rotation, setRotation] = useState({ lon: 0, lat: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStart, setMouseStart] = useState({ x: 0, y: 0 });
  
  const rotationRef = useRef({ lon: 0, lat: 0 });

  // Use provided viewpoints or generate default positions around the model
  const viewpoints = React.useMemo(() => {
    // If viewpoints are provided, use them
    if (providedViewpoints.length > 0) {
      return providedViewpoints;
    }
    
    // Otherwise, generate default circular positions
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
  }, [providedViewpoints, images360.length, modelCenter, cameraDistance]);

  // Sync rotation state to ref for animation loop
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  // Initialize panorama viewer with animation loop
  useEffect(() => {
    if (!panoramaContainerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    panoramaSceneRef.current = scene;

    // Setup camera at origin looking forward
    const camera = new THREE.PerspectiveCamera(
      75,
      panoramaContainerRef.current.clientWidth / panoramaContainerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0);
    panoramaCameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(panoramaContainerRef.current.clientWidth, panoramaContainerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    panoramaContainerRef.current.appendChild(renderer.domElement);
    panoramaRendererRef.current = renderer;

    // Create sphere for panorama - textured sphere using euclidean distance
    // Scale negative on X to invert normals (view from inside)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // Invert to see inside - matches tutorial approach
    
    const material = new THREE.MeshBasicMaterial({
      // No side specified - default THREE.FrontSide works with inverted geometry
    });
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

    // Animation loop - runs continuously
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      if (camera && renderer && scene) {
        // Parametric spherical coordinates: convert lon/lat to 3D direction
        // Using spherical coordinate system (r, theta, phi)
        const phi = THREE.MathUtils.degToRad(90 - rotationRef.current.lat);   // Vertical angle (latitude)
        const theta = THREE.MathUtils.degToRad(rotationRef.current.lon);       // Horizontal angle (longitude)
        
        // Calculate look-at target using spherical to Cartesian conversion
        const radius = 500;
        const target = new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        );
        
        camera.lookAt(target);
        renderer.render(scene, camera);
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
      if (renderer && panoramaContainerRef.current) {
        panoramaContainerRef.current.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

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

    // Add grid helper for reference - larger to accommodate your coordinate range
    const gridHelper = new THREE.GridHelper(250, 25, 0x444444, 0x222222);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Add axes helper for debugging - larger to see coordinates
    const axesHelper = new THREE.AxesHelper(80);
    scene.add(axesHelper);

    // Add position marker (red cone pointing down)
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

  // Add viewpoint markers to mini-map (create once, don't recreate)
  useEffect(() => {
    if (!miniMapSceneRef.current || viewpoints.length === 0) return;

    console.log('Creating mini-map markers for viewpoints:', viewpoints);
    const scene = miniMapSceneRef.current;
    const markers: THREE.Mesh[] = [];

    // Create a marker for each viewpoint
    viewpoints.forEach((viewpoint, index) => {
      console.log(`Marker ${index + 1}:`, viewpoint.position);
      
      // Create sphere marker - always green initially
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true
      });
      const marker = new THREE.Mesh(geometry, material);
      
      // Position marker - use X and Z from viewpoint
      marker.position.set(
        viewpoint.position.x,
        2, // Height above ground
        viewpoint.position.z
      );
      
      // Add label (position number)
      marker.userData = { index, viewpoint };
      
      scene.add(marker);
      markers.push(marker);
    });

    // Adjust camera to fit all viewpoints
    if (viewpoints.length > 0) {
      const positions = viewpoints.map(v => v.position);
      const minX = Math.min(...positions.map(p => p.x));
      const maxX = Math.max(...positions.map(p => p.x));
      const minZ = Math.min(...positions.map(p => p.z));
      const maxZ = Math.max(...positions.map(p => p.z));
      
      console.log('Viewpoint bounds:', { minX, maxX, minZ, maxZ });
      
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const rangeX = maxX - minX;
      const rangeZ = maxZ - minZ;
      const maxRange = Math.max(rangeX, rangeZ, 40); // Increased minimum from 20 to 40
      
      console.log('Camera setup:', { centerX, centerZ, rangeX, rangeZ, maxRange });
      
      if (miniMapCameraRef.current && miniMapContainerRef.current) {
        const camera = miniMapCameraRef.current as THREE.OrthographicCamera;
        const containerWidth = miniMapContainerRef.current.clientWidth;
        const containerHeight = miniMapContainerRef.current.clientHeight;
        const aspect = containerWidth / containerHeight;
        
        // Add 50% padding to ensure all points are visible
        const frustumSize = maxRange * 1.5;
        
        camera.left = -frustumSize * aspect / 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.position.set(centerX, 100, centerZ);
        camera.lookAt(centerX, 0, centerZ);
        camera.updateProjectionMatrix();
        
        console.log('Camera frustum:', { 
          left: camera.left, 
          right: camera.right, 
          top: camera.top, 
          bottom: camera.bottom,
          position: camera.position
        });
      }
    }

    // Cleanup
    return () => {
      markers.forEach(marker => {
        scene.remove(marker);
        marker.geometry.dispose();
        if (marker.material instanceof THREE.Material) {
          marker.material.dispose();
        }
      });
    };
  }, [viewpoints]); // Only recreate when viewpoints change, not currentImageIndex

  // Update marker colors when current position changes
  useEffect(() => {
    if (!miniMapSceneRef.current) return;

    // Find all sphere markers and update their colors
    miniMapSceneRef.current.children.forEach(child => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry && child.userData.index !== undefined) {
        const isCurrentPosition = child.userData.index === currentImageIndex;
        if (child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.setHex(isCurrentPosition ? 0xff0000 : 0x00ff00);
          child.material.opacity = isCurrentPosition ? 1.0 : 0.8;
          child.material.needsUpdate = true;
        }
      }
    });
  }, [currentImageIndex]);

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

  // Mouse controls for parametric view
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setMouseStart({ x: e.clientX, y: e.clientY });
    console.log('Mouse down - start dragging at', e.clientX, e.clientY);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const deltaX = e.clientX - mouseStart.x;
    const deltaY = e.clientY - mouseStart.y;

    const newLon = rotationRef.current.lon - deltaX * 0.2;
    const newLat = Math.max(-85, Math.min(85, rotationRef.current.lat - deltaY * 0.2));
    
    rotationRef.current = { lon: newLon, lat: newLat };
    setRotation({ lon: newLon, lat: newLat });
    
    console.log('Rotation:', rotationRef.current);
    setMouseStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, mouseStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      console.log('Mouse up - stop dragging');
    }
    setIsDragging(false);
  }, [isDragging]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      setIsDragging(true);
      setMouseStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();

    const deltaX = e.touches[0].clientX - mouseStart.x;
    const deltaY = e.touches[0].clientY - mouseStart.y;

    const newLon = rotationRef.current.lon - deltaX * 0.2;
    const newLat = Math.max(-85, Math.min(85, rotationRef.current.lat - deltaY * 0.2));
    
    rotationRef.current = { lon: newLon, lat: newLat };
    setRotation({ lon: newLon, lat: newLat });

    setMouseStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, [isDragging, mouseStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mini-map click to navigate to position
  const handleMiniMapClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!miniMapContainerRef.current || !miniMapCameraRef.current || !miniMapSceneRef.current) return;

    const rect = miniMapContainerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    console.log('Mini-map clicked at:', { x, y, clientX: event.clientX, clientY: event.clientY });

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), miniMapCameraRef.current);

    // Find all sphere markers
    const markers = miniMapSceneRef.current.children.filter(
      child => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry
    );

    console.log('Checking', markers.length, 'markers for intersection');

    const intersects = raycaster.intersectObjects(markers);
    
    console.log('Intersections found:', intersects.length);
    
    if (intersects.length > 0) {
      const clickedMarker = intersects[0].object;
      const index = clickedMarker.userData.index;
      console.log('Clicked marker index:', index);
      if (index !== undefined && index !== currentImageIndex) {
        console.log('Navigating to position:', index);
        setCurrentImageIndex(index);
        setRotation({ lon: 0, lat: 0 });
        rotationRef.current = { lon: 0, lat: 0 };
        onViewpointChange?.(index);
      }
    }
  }, [currentImageIndex, onViewpointChange]);

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
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none'
            }}
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
              <div 
                ref={miniMapContainerRef} 
                className="w-full h-full cursor-pointer"
                onClick={handleMiniMapClick}
                title="Click on a marker to jump to that position"
              />
              {/* Position labels overlay */}
              <div className="absolute bottom-2 left-2 right-2 text-xs space-y-1">
                <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span>Current Position</span>
                  </div>
                </div>
                <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 opacity-70"></div>
                    <span>Other Positions (click to navigate)</span>
                  </div>
                </div>
              </div>
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
