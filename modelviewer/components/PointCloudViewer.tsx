import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface CameraData {
  camera_intrinsics: {
    fx: number;
    fy: number;
    cx: number;
    cy: number;
  };
  images: Array<{
    image_id: number;
    name: string;
    camera_pose: number[][];
    position: number[];
    rotation_matrix: number[][];
  }>;
  points_3d?: number[][];
  point_colors?: number[][];
}

interface PointCloudViewerProps {
  cameraDataPath?: string;
  onCameraSelect?: (imageId: number, imageName: string) => void;
}

export const PointCloudViewer: React.FC<PointCloudViewerProps> = ({
  cameraDataPath = 'sfm_output/camera_poses.json',
  onCameraSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [cameraData, setCameraData] = useState<CameraData | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load camera data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await window.electron.readCameraPoses(cameraDataPath);
        if (data) {
          setCameraData(data);
          setIsLoading(false);
        } else {
          setError('Failed to load camera data file');
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(`Failed to load camera data: ${err.message}`);
        setIsLoading(false);
      }
    };

    loadData();
  }, [cameraDataPath]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !cameraData) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Axes
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);

    // Add camera frustums and trajectory
    addCameraVisualizations(scene, cameraData);

    // Add 3D point cloud if available
    if (cameraData.points_3d && cameraData.points_3d.length > 0) {
      addPointCloud(scene, cameraData);
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [cameraData]);

  const addCameraVisualizations = (scene: THREE.Scene, data: CameraData) => {
    const positions: THREE.Vector3[] = [];
    const cameraObjects: THREE.Object3D[] = [];

    data.images.forEach((img, index) => {
      const position = new THREE.Vector3(img.position[0], img.position[1], img.position[2]);
      positions.push(position);

      // Create camera frustum
      const frustum = createCameraFrustum(img, index);
      scene.add(frustum);
      cameraObjects.push(frustum);

      // Add camera label
      const label = createTextSprite(img.name, index);
      label.position.copy(position);
      label.position.y += 0.3;
      scene.add(label);
    });

    // Create trajectory line
    const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(positions);
    const trajectoryMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00aaff, 
      linewidth: 2,
      opacity: 0.6,
      transparent: true
    });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);

    // Add raycasting for camera selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(cameraObjects, true);

      if (intersects.length > 0) {
        const selectedObj = intersects[0].object;
        const cameraIndex = parseInt(selectedObj.userData.cameraIndex);
        if (!isNaN(cameraIndex)) {
          setSelectedCamera(cameraIndex);
          highlightCamera(cameraObjects, cameraIndex);
          if (onCameraSelect) {
            onCameraSelect(data.images[cameraIndex].image_id, data.images[cameraIndex].name);
          }
        }
      }
    };

    containerRef.current?.addEventListener('click', onMouseClick);
  };

  const addPointCloud = (scene: THREE.Scene, data: CameraData) => {
    if (!data.points_3d || data.points_3d.length === 0) return;

    const positions = new Float32Array(data.points_3d.length * 3);
    const colors = new Float32Array(data.points_3d.length * 3);

    data.points_3d.forEach((point, i) => {
      positions[i * 3] = point[0];
      positions[i * 3 + 1] = point[1];
      positions[i * 3 + 2] = point[2];

      if (data.point_colors && data.point_colors[i]) {
        colors[i * 3] = data.point_colors[i][0] / 255;
        colors[i * 3 + 1] = data.point_colors[i][1] / 255;
        colors[i * 3 + 2] = data.point_colors[i][2] / 255;
      } else {
        // Default white color
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);

    console.log(`Added ${data.points_3d.length} 3D points to scene`);
  };

  const createCameraFrustum = (img: CameraData['images'][0], index: number): THREE.Object3D => {
    const group = new THREE.Group();
    group.userData.cameraIndex = index;

    // Camera position
    const position = new THREE.Vector3(img.position[0], img.position[1], img.position[2]);

    // Create rotation matrix
    const rotationMatrix = new THREE.Matrix4();
    const rot = img.rotation_matrix;
    rotationMatrix.set(
      rot[0][0], rot[0][1], rot[0][2], 0,
      rot[1][0], rot[1][1], rot[1][2], 0,
      rot[2][0], rot[2][1], rot[2][2], 0,
      0, 0, 0, 1
    );

    // Camera frustum geometry
    const frustumSize = 0.2;
    const frustumDepth = 0.3;
    
    const frustumGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Pyramid from camera center
      0, 0, 0,  -frustumSize, -frustumSize, frustumDepth,
      0, 0, 0,  frustumSize, -frustumSize, frustumDepth,
      0, 0, 0,  frustumSize, frustumSize, frustumDepth,
      0, 0, 0,  -frustumSize, frustumSize, frustumDepth,
      // Far plane
      -frustumSize, -frustumSize, frustumDepth,  frustumSize, -frustumSize, frustumDepth,
      frustumSize, -frustumSize, frustumDepth,  frustumSize, frustumSize, frustumDepth,
      frustumSize, frustumSize, frustumDepth,  -frustumSize, frustumSize, frustumDepth,
      -frustumSize, frustumSize, frustumDepth,  -frustumSize, -frustumSize, frustumDepth,
    ]);
    frustumGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const frustumMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      opacity: 0.8,
      transparent: true
    });
    const frustumLines = new THREE.LineSegments(frustumGeometry, frustumMaterial);

    // Camera sphere (clickable target)
    const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff4444,
      opacity: 0.8,
      transparent: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.userData.cameraIndex = index;

    group.add(frustumLines);
    group.add(sphere);
    group.position.copy(position);
    group.setRotationFromMatrix(rotationMatrix);

    return group;
  };

  const createTextSprite = (text: string, index: number): THREE.Sprite => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'Bold 24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 8);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.5, 0.125, 1);

    return sprite;
  };

  const highlightCamera = (cameraObjects: THREE.Object3D[], selectedIndex: number) => {
    cameraObjects.forEach((obj, index) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          if (index === selectedIndex) {
            (child.material as THREE.Material).opacity = 1.0;
            if (child instanceof THREE.Mesh) {
              (child.material as THREE.MeshBasicMaterial).color.set(0xffff00);
            } else {
              (child.material as THREE.LineBasicMaterial).color.set(0xffff00);
            }
          } else {
            (child.material as THREE.Material).opacity = 0.6;
            if (child instanceof THREE.Mesh) {
              (child.material as THREE.MeshBasicMaterial).color.set(0xff4444);
            } else {
              (child.material as THREE.LineBasicMaterial).color.set(0x00ff00);
            }
          }
        }
      });
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading camera data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Info panel */}
      <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-lg max-w-xs">
        <h3 className="font-bold text-lg mb-2">Camera Reconstruction</h3>
        <p className="text-sm mb-1">Cameras: {cameraData?.images.length || 0}</p>
        <p className="text-sm mb-1">3D Points: {cameraData?.points_3d?.length || 0}</p>
        {selectedCamera !== null && cameraData && (
          <div className="mt-2 pt-2 border-t border-gray-600">
            <p className="text-sm font-semibold">Selected: {cameraData.images[selectedCamera].name}</p>
            <p className="text-xs text-gray-400">
              Position: [{cameraData.images[selectedCamera].position.map(v => v.toFixed(2)).join(', ')}]
            </p>
          </div>
        )}
        <div className="mt-4 text-xs text-gray-400">
          <p>🖱️ Click cameras to select</p>
          <p>🔄 Drag to rotate view</p>
          <p>🔍 Scroll to zoom</p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span>Camera Position</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-green-500"></div>
          <span>Camera Frustum</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-1 bg-blue-400"></div>
          <span>Camera Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white rounded-full" style={{ width: '4px', height: '4px' }}></div>
          <span>3D Points</span>
        </div>
      </div>
    </div>
  );
};
