import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export interface ViewPoint {
  id: string;
  imageUrl: string;
  position: { x: number; y: number, z: number };
  neighbors: Array<{
    id: string;
    direction: number; // angle in degrees
    distance: number;
  }>;
}

export interface StreetViewerProps {
  viewPoints: ViewPoint[];
  initialViewPointId?: string;
  onViewPointChange?: (viewPointId: string) => void;
}

export const StreetViewer: React.FC<StreetViewerProps> = ({
  viewPoints,
  initialViewPointId,
  onViewPointChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const navigationHotspotsRef = useRef<THREE.Mesh[]>([]);
  const requestRef = useRef<number>();
  
  const [currentViewPoint, setCurrentViewPoint] = useState<ViewPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mouseStart, setMouseStart] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ lon: 0, lat: 0 });
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0.1);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create sphere for panorama
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // Invert to see inside
    const material = new THREE.MeshBasicMaterial();
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

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
      
      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        // Update camera rotation based on mouse interaction
        const phi = THREE.MathUtils.degToRad(90 - rotation.lat);
        const theta = THREE.MathUtils.degToRad(rotation.lon);
        
        cameraRef.current.target = new THREE.Vector3(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        );
        cameraRef.current.lookAt(cameraRef.current.target);
        
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
  }, [rotation]);

  // Load initial viewpoint
  useEffect(() => {
    const initialId = initialViewPointId || viewPoints[0]?.id;
    if (initialId) {
      const viewPoint = viewPoints.find(vp => vp.id === initialId);
      if (viewPoint) {
        loadViewPoint(viewPoint);
      }
    }
  }, [initialViewPointId, viewPoints]);

  // Load a new viewpoint
  const loadViewPoint = useCallback(async (viewPoint: ViewPoint) => {
    if (!sphereRef.current) return;

    setIsLoading(true);

    try {
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
          viewPoint.imageUrl,
          (texture) => resolve(texture),
          undefined,
          (error) => reject(error)
        );
      });

      texture.colorSpace = THREE.SRGBColorSpace;
      
      if (sphereRef.current.material instanceof THREE.MeshBasicMaterial) {
        sphereRef.current.material.map = texture;
        sphereRef.current.material.needsUpdate = true;
      }

      // Clear existing hotspots
      navigationHotspotsRef.current.forEach(hotspot => {
        sceneRef.current?.remove(hotspot);
      });
      navigationHotspotsRef.current = [];

      // Create navigation hotspots for neighbors
      viewPoint.neighbors.forEach(neighbor => {
        const neighborViewPoint = viewPoints.find(vp => vp.id === neighbor.id);
        if (!neighborViewPoint || !sceneRef.current) return;

        // Create hotspot geometry
        const hotspotGeometry = new THREE.SphereGeometry(15, 16, 16);
        const hotspotMaterial = new THREE.MeshBasicMaterial({
          color: 0x4a9eff,
          opacity: 0.7,
          transparent: true
        });
        const hotspot = new THREE.Mesh(hotspotGeometry, hotspotMaterial);

        // Position hotspot based on direction
        const phi = THREE.MathUtils.degToRad(90);
        const theta = THREE.MathUtils.degToRad(neighbor.direction);
        const radius = 450;

        hotspot.position.set(
          radius * Math.sin(phi) * Math.cos(theta),
          0,
          radius * Math.sin(phi) * Math.sin(theta)
        );

        hotspot.userData = { neighborId: neighbor.id };
        sceneRef.current.add(hotspot);
        navigationHotspotsRef.current.push(hotspot);
      });

      setCurrentViewPoint(viewPoint);
      onViewPointChange?.(viewPoint.id);
    } catch (error) {
      console.error('Failed to load viewpoint:', error);
    } finally {
      setIsLoading(false);
    }
  }, [viewPoints, onViewPointChange]);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      // Check for hotspot hover
      checkHotspotHover(e.clientX, e.clientY);
      return;
    }

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

  const handleClick = (e: React.MouseEvent) => {
    if (!cameraRef.current || !sceneRef.current) return;

    // Raycasting for hotspot clicks
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(navigationHotspotsRef.current);
    
    if (intersects.length > 0) {
      const neighborId = intersects[0].object.userData.neighborId;
      const nextViewPoint = viewPoints.find(vp => vp.id === neighborId);
      if (nextViewPoint) {
        loadViewPoint(nextViewPoint);
      }
    }
  };

  const checkHotspotHover = (clientX: number, clientY: number) => {
    if (!cameraRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(navigationHotspotsRef.current);
    
    if (intersects.length > 0) {
      const neighborId = intersects[0].object.userData.neighborId;
      setHoveredHotspot(neighborId);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    } else {
      setHoveredHotspot(null);
      if (containerRef.current) {
        containerRef.current.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    }
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
    <Card className="w-full h-full relative overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 space-y-2">
        {currentViewPoint && (
          <Badge variant="secondary" className="text-sm">
            Location: {currentViewPoint.id}
          </Badge>
        )}
        {isLoading && (
          <Badge variant="outline" className="text-sm">
            Loading...
          </Badge>
        )}
      </div>

      {/* Navigation info */}
      {hoveredHotspot && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Badge className="text-sm">
            Click to navigate to {hoveredHotspot}
          </Badge>
        </div>
      )}

      {/* Controls info */}
      <div className="absolute bottom-4 right-4">
        <Badge variant="secondary" className="text-xs">
          Drag to look around • Click blue spheres to navigate
        </Badge>
      </div>
    </Card>
  );
};
