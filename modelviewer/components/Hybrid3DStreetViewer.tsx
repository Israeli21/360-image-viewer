import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ChevronLeft, ChevronRight, MapPin, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

export interface CameraViewpoint {
  id: string;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  name: string;
  angle: number; // Angle around the model in degrees
  imageIndices: number[]; // Indices of the 3 closest images
}

export interface Hybrid3DStreetViewerProps {
  glbPath: string | null;
  images: string[]; // Paths to the source images
  modelCenter?: { x: number; y: number; z: number };
  cameraDistance?: number; // Distance from model center
  onViewpointChange?: (viewpoint: CameraViewpoint) => void;
}

export const Hybrid3DStreetViewer: React.FC<Hybrid3DStreetViewerProps> = ({
  glbPath,
  images,
  modelCenter = { x: 0, y: 0, z: 0 },
  cameraDistance = 5,
  onViewpointChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const viewpointMarkersRef = useRef<THREE.Mesh[]>([]);
  const imageBillboardsRef = useRef<THREE.Mesh[]>([]);
  const requestRef = useRef<number | undefined>(undefined);

  const [viewpoints, setViewpoints] = useState<CameraViewpoint[]>([]);
  const [currentViewpointIndex, setCurrentViewpointIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [rotation, setRotation] = useState({ lon: 0, lat: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStart, setMouseStart] = useState({ x: 0, y: 0 });

  // Generate 10 viewpoints circling the model
  useEffect(() => {
    const numViewpoints = 10;
    const generatedViewpoints: CameraViewpoint[] = [];

    for (let i = 0; i < numViewpoints; i++) {
      const angle = (i / numViewpoints) * 360;
      const radian = (angle * Math.PI) / 180;

      // Position camera in a circle around the model
      const position = {
        x: modelCenter.x + cameraDistance * Math.cos(radian),
        y: modelCenter.y + cameraDistance / 2, // Slightly elevated
        z: modelCenter.z + cameraDistance * Math.sin(radian)
      };

      // Determine the 3 closest images for this viewpoint
      // We'll distribute images evenly around the circle
      const imagesPerViewpoint = Math.ceil(images.length / numViewpoints);
      const startIdx = (i * imagesPerViewpoint) % images.length;
      const imageIndices = [
        startIdx % images.length,
        (startIdx + 1) % images.length,
        (startIdx + 2) % images.length
      ].filter((idx, pos, self) => self.indexOf(idx) === pos); // Remove duplicates

      generatedViewpoints.push({
        id: `viewpoint-${i + 1}`,
        position,
        lookAt: modelCenter,
        name: `Position ${i + 1}`,
        angle,
        imageIndices: imageIndices.slice(0, Math.min(3, images.length))
      });
    }

    setViewpoints(generatedViewpoints);
  }, [images.length, modelCenter, cameraDistance]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Add ambient light - brighter
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // Add directional light - multiple lights from different angles
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight1.position.set(10, 10, 10);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, 10, -10);
    scene.add(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight3.position.set(0, -10, 0);
    scene.add(directionalLight3);

    // Add hemisphere light for better overall illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(cameraDistance, cameraDistance / 2, cameraDistance);
    camera.lookAt(modelCenter.x, modelCenter.y, modelCenter.z);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Update camera rotation based on mouse drag (Street View style)
        const phi = THREE.MathUtils.degToRad(90 - rotation.lat);
        const theta = THREE.MathUtils.degToRad(rotation.lon);
        
        const currentVP = viewpoints[currentViewpointIndex];
        if (currentVP) {
          // Camera stays at viewpoint position
          cameraRef.current.position.set(
            currentVP.position.x,
            currentVP.position.y,
            currentVP.position.z
          );
          
          // Look direction based on rotation
          const lookTarget = new THREE.Vector3(
            currentVP.position.x + 500 * Math.sin(phi) * Math.cos(theta),
            currentVP.position.y + 500 * Math.cos(phi),
            currentVP.position.z + 500 * Math.sin(phi) * Math.sin(theta)
          );
          
          cameraRef.current.lookAt(lookTarget);
        }
        
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [modelCenter, cameraDistance, rotation, viewpoints, currentViewpointIndex]);

  // Load GLB model
  useEffect(() => {
    if (!glbPath || !sceneRef.current) return;

    setIsLoading(true);

    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        // Remove previous model if exists
        if (modelRef.current && sceneRef.current) {
          sceneRef.current.remove(modelRef.current);
        }

        const model = gltf.scene;
        
        // Center the model and calculate bounds
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Move model so its center is at modelCenter
        model.position.set(
          modelCenter.x - center.x,
          modelCenter.y - center.y,
          modelCenter.z - center.z
        );

        // Try to fix orientation - some models need different rotations
        // If model is still upside down, we can adjust this
        // model.rotation.x = Math.PI; // Try commenting this out if model disappears
        
        console.log('Model loaded:', {
          size: size,
          center: center,
          position: model.position
        });
        
        sceneRef.current?.add(model);
        modelRef.current = model;
        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading GLB:', error);
        setIsLoading(false);
      }
    );
  }, [glbPath, modelCenter]);

  // Create viewpoint markers
  useEffect(() => {
    if (!sceneRef.current || viewpoints.length === 0) return;

    // Remove existing markers
    viewpointMarkersRef.current.forEach(marker => {
      sceneRef.current?.remove(marker);
    });
    viewpointMarkersRef.current = [];

    // Create new markers
    viewpoints.forEach((vp, index) => {
      const geometry = new THREE.SphereGeometry(0.15, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: index === currentViewpointIndex ? 0x00ff00 : 0x4a9eff,
        opacity: 0.8,
        transparent: true
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(vp.position.x, vp.position.y, vp.position.z);
      marker.userData = { viewpointIndex: index };

      sceneRef.current?.add(marker);
      viewpointMarkersRef.current.push(marker);
    });
  }, [viewpoints, currentViewpointIndex]);

  // Create image billboards in 3D space
  useEffect(() => {
    if (!sceneRef.current || images.length === 0 || viewpoints.length === 0 || !showImages) return;

    // Remove existing billboards
    imageBillboardsRef.current.forEach(billboard => {
      sceneRef.current?.remove(billboard);
    });
    imageBillboardsRef.current = [];

    const currentVP = viewpoints[currentViewpointIndex];
    if (!currentVP) return;

    const textureLoader = new THREE.TextureLoader();

    // Load and display the 3 closest images as billboards
    currentVP.imageIndices.forEach((imageIdx, billboardIdx) => {
      const imagePath = images[imageIdx];
      
      textureLoader.load(imagePath, (texture) => {
        // Create plane geometry with aspect ratio matching image
        const aspectRatio = texture.image.width / texture.image.height;
        const billboardWidth = 1.5; // Made smaller
        const billboardHeight = billboardWidth / aspectRatio;

        const geometry = new THREE.PlaneGeometry(billboardWidth, billboardHeight);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });

        const billboard = new THREE.Mesh(geometry, material);

        // Position billboards around the model at the viewing angle
        // Spread them out more and position them further from model
        const angleOffset = (billboardIdx - 1) * 40; // Increased spread
        const angle = (currentVP.angle + angleOffset) * (Math.PI / 180);
        const billboardDistance = cameraDistance * 0.85; // Further from center

        billboard.position.set(
          modelCenter.x + billboardDistance * Math.cos(angle),
          modelCenter.y + billboardHeight / 2,
          modelCenter.z + billboardDistance * Math.sin(angle)
        );

        // Make billboard face the camera viewpoint instead of model center
        billboard.lookAt(currentVP.position.x, currentVP.position.y, currentVP.position.z);

        sceneRef.current?.add(billboard);
        imageBillboardsRef.current.push(billboard);
      });
    });

    return () => {
      // Cleanup billboards
      imageBillboardsRef.current.forEach(billboard => {
        sceneRef.current?.remove(billboard);
        if (billboard.material instanceof THREE.Material) {
          billboard.material.dispose();
        }
        billboard.geometry.dispose();
      });
      imageBillboardsRef.current = [];
    };
  }, [images, viewpoints, currentViewpointIndex, modelCenter, cameraDistance, showImages]);

  // Animate camera to viewpoint
  const moveToViewpoint = useCallback((index: number) => {
    if (!cameraRef.current || !viewpoints[index]) return;

    setIsTransitioning(true);
    const targetViewpoint = viewpoints[index];

    // Animate camera position
    const startPos = cameraRef.current.position.clone();
    const endPos = new THREE.Vector3(
      targetViewpoint.position.x,
      targetViewpoint.position.y,
      targetViewpoint.position.z
    );

    const duration = 1000; // 1 second
    const startTime = Date.now();

    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (cameraRef.current) {
        cameraRef.current.position.lerpVectors(startPos, endPos, eased);
      }

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        setIsTransitioning(false);
        // Reset rotation when arriving at new viewpoint
        setRotation({ lon: 0, lat: 0 });
      }
    };

    animateCamera();
    setCurrentViewpointIndex(index);
    onViewpointChange?.(targetViewpoint);

    // Update marker colors
    viewpointMarkersRef.current.forEach((marker, i) => {
      if (marker.material instanceof THREE.MeshBasicMaterial) {
        marker.material.color.setHex(i === index ? 0x00ff00 : 0x4a9eff);
      }
    });
  }, [viewpoints, onViewpointChange]);

  const handlePrevViewpoint = () => {
    if (isTransitioning) return;
    const newIndex = (currentViewpointIndex - 1 + viewpoints.length) % viewpoints.length;
    moveToViewpoint(newIndex);
  };

  const handleNextViewpoint = () => {
    if (isTransitioning) return;
    const newIndex = (currentViewpointIndex + 1) % viewpoints.length;
    moveToViewpoint(newIndex);
  };

  // Mouse interaction handlers for Street View-style look around
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

  const currentViewpoint = viewpoints[currentViewpointIndex];
  const currentImages = currentViewpoint?.imageIndices.map(idx => images[idx]) || [];

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <MapPin className="h-3 w-3 mr-1" />
            {currentViewpoint?.name || 'Loading...'}
          </Badge>
          {isLoading && <Badge variant="outline">Loading 3D Model...</Badge>}
          {isTransitioning && <Badge variant="outline">Moving...</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowImages(!showImages)}
          >
            {showImages ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showImages ? 'Hide Billboards' : 'Show Billboards'}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrevViewpoint}
              disabled={isTransitioning}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {currentViewpointIndex + 1} / {viewpoints.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextViewpoint}
              disabled={isTransitioning}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 relative">
          <div 
            ref={containerRef} 
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
          
          {/* Left Arrow - Google Street View Style */}
          <Button
            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-20 w-12 rounded-full bg-background/80 hover:bg-background/90 backdrop-blur-sm"
            variant="ghost"
            onClick={handlePrevViewpoint}
            disabled={isTransitioning}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          {/* Right Arrow - Google Street View Style */}
          <Button
            className="absolute right-4 top-1/2 transform -translate-y-1/2 h-20 w-12 rounded-full bg-background/80 hover:bg-background/90 backdrop-blur-sm"
            variant="ghost"
            onClick={handleNextViewpoint}
            disabled={isTransitioning}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
          
          {/* Viewpoint selector overlay */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 bg-background/90 backdrop-blur-sm p-2 rounded-lg border">
            {viewpoints.map((vp, index) => (
              <Button
                key={vp.id}
                size="sm"
                variant={index === currentViewpointIndex ? 'default' : 'ghost'}
                onClick={() => moveToViewpoint(index)}
                disabled={isTransitioning}
                className="w-8 h-8 p-0"
              >
                {index + 1}
              </Button>
            ))}
          </div>

          {/* Instructions overlay */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
            Drag to look around • Click arrows to move
          </div>
        </div>

        {/* Source Images Panel */}
        {showImages && currentImages.length > 0 && !isTransitioning && (
          <Card className="w-96 flex-shrink-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Source Images ({currentImages.length})</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Displayed as billboards in 3D
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowImages(false)}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {currentImages.map((imagePath, idx) => (
                <div key={idx} className="space-y-1">
                  <Badge variant="outline" className="text-xs">
                    Image {currentViewpoint.imageIndices[idx] + 1}
                  </Badge>
                  <div className="relative w-full aspect-video bg-muted rounded overflow-hidden">
                    <img
                      src={imagePath}
                      alt={`Source ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {imagePath.split(/[\\/]/).pop()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Instructions */}
      <div className="p-2 border-t bg-card text-xs text-muted-foreground text-center">
        Use arrow buttons or number keys to navigate • Drag to rotate view • Scroll to zoom
      </div>
    </div>
  );
};
