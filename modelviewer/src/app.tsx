import { createRoot } from 'react-dom/client'
import React, { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { FileTree } from "@/components/FileTree"
import { PDFViewer } from "@/components/PDFViewer"
import { GLBViewer } from "@/components/GLBViewer"
import { QAPairsViewer } from "@/components/QAPairsViewer"
import { ImageGallery } from "@/components/ImageGallery"
import { SceneGraphViewer } from "@/components/SceneGraphViewer"
import { ChatInterface, type ViewerCommand } from "@/components/ChatInterface"
import { StreetViewerDemo } from "@/src/StreetViewerDemo"
import { PointCloudDemo } from "@/components/PointCloudDemo"
import { ViewerProvider } from "@/src/contexts/ViewerContext"
import type { GLBViewerControls, SceneGraphViewerControls } from "@/src/contexts/ViewerContext"
import { FolderOpen, Box, Map, Camera } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [glbPath, setGlbPath] = useState<string | null>(null);
  const [qaPairsPath, setQaPairsPath] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'sceneGraph' | '3dModel'>('3dModel');
  const [viewMode, setViewMode] = useState<'scene' | 'glb-only' | 'street-viewer' | 'point-cloud'>('scene');
  const [glbOnlyPath, setGlbOnlyPath] = useState<string | null>(null);

  // Refs for viewer controls
  const glbViewerRef = useRef<GLBViewerControls>(null);
  const sceneGraphViewerRef = useRef<SceneGraphViewerControls>(null);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Update PDF path when scene changes
  useEffect(() => {
    const updatePDFPath = async () => {
      if (!selectedScene) {
        setPdfPath(null);
        return;
      }

      const path = await window.electron.getScenePDFPath(selectedScene);
      setPdfPath(path);
    };

    updatePDFPath();
  }, [selectedScene]);

  // Update GLB path when scene changes
  useEffect(() => {
    const updateGLBPath = async () => {
      if (!selectedScene) {
        setGlbPath(null);
        return;
      }

      const path = await window.electron.getSceneGLBPath(selectedScene);
      setGlbPath(path);
    };

    updateGLBPath();
  }, [selectedScene]);

  // Update QA pairs path when scene changes
  useEffect(() => {
    const updateQAPairsPath = async () => {
      if (!selectedScene) {
        setQaPairsPath(null);
        return;
      }

      const path = await window.electron.getSceneQAPairsPath(selectedScene);
      setQaPairsPath(path);
    };

    updateQAPairsPath();
  }, [selectedScene]);

  // Auto-open Downloads folder on mount
  useEffect(() => {
    const openDownloads = async () => {
      const downloadsPath = await window.electron.getDownloadsPath?.();
      if (downloadsPath) {
        setRootPath(downloadsPath);
      }
    };
    openDownloads();
  }, []);

  const handleOpenFolder = async () => {
    const path = await window.electron.openDirectory();
    if (path) {
      setRootPath(path);
      setSelectedFile(null);
      setSelectedScene(null);
      setViewMode('scene');
      setGlbOnlyPath(null);
    }
  };

  const handleOpenGLBFile = async () => {
    const path = await window.electron.openGLBFile();
    if (path) {
      setGlbOnlyPath(path);
      setViewMode('glb-only');
    }
  };

  const handleOpenStreetViewer = () => {
    setViewMode('street-viewer');
  };

  const handleOpenPointCloud = () => {
    setViewMode('point-cloud');
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    console.log('Selected file:', path);
  };

  const handleSceneSelect = (path: string) => {
    setSelectedScene(path);
    console.log('Selected scene:', path);
  };

  const handleViewerCommand = (command: ViewerCommand) => {
    console.log('Executing viewer command:', command);

    switch (command.type) {
      case 'glb':
        if (glbViewerRef.current) {
          switch (command.action) {
            case 'resetCamera':
              glbViewerRef.current.resetCamera();
              break;
            case 'setCameraPosition':
              if (command.params?.x !== undefined && command.params?.y !== undefined && command.params?.z !== undefined) {
                glbViewerRef.current.setCameraPosition(
                  command.params.x as number,
                  command.params.y as number,
                  command.params.z as number
                );
              }
              break;
            case 'focusOnPoint':
              if (command.params?.x !== undefined && command.params?.y !== undefined && command.params?.z !== undefined) {
                glbViewerRef.current.focusOnPoint(
                  command.params.x as number,
                  command.params.y as number,
                  command.params.z as number
                );
              }
              break;
          }
        }
        break;

      case 'sceneGraph':
        if (sceneGraphViewerRef.current) {
          switch (command.action) {
            case 'selectNode':
              if (command.params?.nodeId) {
                sceneGraphViewerRef.current.selectNode(command.params.nodeId as string);
              }
              break;
            case 'clearSelection':
              sceneGraphViewerRef.current.clearSelection();
              break;
            case 'highlightNodes':
              if (command.params?.nodeIds && Array.isArray(command.params.nodeIds)) {
                sceneGraphViewerRef.current.highlightNodes(command.params.nodeIds as string[]);
              }
              break;
            case 'zoomToNode':
              if (command.params?.nodeId) {
                sceneGraphViewerRef.current.zoomToNode(command.params.nodeId as string);
              }
              break;
            case 'resetView':
              sceneGraphViewerRef.current.resetView();
              break;
          }
        }
        break;

      case 'camera':
        // Handle view switching
        if (command.action === 'switch3D') {
          setActiveView('3dModel');
        } else if (command.action === 'switchGraph') {
          setActiveView('sceneGraph');
        }
        break;
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark bg-background text-foreground h-screen w-full flex overflow-hidden">
        <Sidebar
          collapsible="none"
          sideColumnButtons={
            <>
              <Button onClick={handleOpenFolder} variant="ghost" size="icon" className="size-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <FolderOpen className="size-sidebar-icon" />
                <span className="sr-only">Open Folder</span>
              </Button>
              <Button onClick={handleOpenGLBFile} variant="ghost" size="icon" className="size-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Box className="size-sidebar-icon" />
                <span className="sr-only">Open GLB File</span>
              </Button>
              <Button onClick={handleOpenStreetViewer} variant="ghost" size="icon" className="size-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Map className="size-sidebar-icon" />
                <span className="sr-only">Street Viewer</span>
              </Button>
              <Button onClick={handleOpenPointCloud} variant="ghost" size="icon" className="size-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Camera className="size-sidebar-icon" />
                <span className="sr-only">Point Cloud</span>
              </Button>
            </>
          }
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Scenes</SidebarGroupLabel>
              <SidebarGroupContent>
                <FileTree
                  rootPath={rootPath}
                  selectedScene={selectedScene}
                  onSceneSelect={handleSceneSelect}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Viewer Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1">
            {viewMode === 'point-cloud' ? (
              // Point Cloud mode: Full-screen 3D camera reconstruction viewer
              <PointCloudDemo />
            ) : viewMode === 'street-viewer' ? (
              // Street Viewer mode: Full-screen panoramic viewer
              <StreetViewerDemo />
            ) : viewMode === 'glb-only' ? (
              // GLB-only mode: Full-screen 3D viewer
              glbOnlyPath ? (
                <GLBViewer ref={glbViewerRef} glbPath={glbOnlyPath} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-muted-foreground">Please select a GLB file</span>
                </div>
              )
            ) : !selectedScene ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-muted-foreground">Please select a scene</span>
              </div>
            ) : (
              <ResizablePanelGroup direction="vertical" className="h-full rounded-lg">
                {/* Top Row: 2 Columns */}
                <ResizablePanel defaultSize={50}>
                  <ResizablePanelGroup direction="horizontal">
                    {/* Left Panel: Chat Interface */}
                    <ResizablePanel defaultSize={33}>
                      <ChatInterface onCommand={handleViewerCommand} />
                    </ResizablePanel>
                    <ResizableHandle />
                    {/* Right Panel: Combined View with Switcher */}
                    <ResizablePanel defaultSize={67}>
                      <div className="relative h-full w-full">
                        {/* Toggle Button Group - Top Left */}
                        <div className="absolute top-2 left-2 z-10 flex gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-md p-1 shadow-lg">
                          <Button
                            size="sm"
                            variant={activeView === '3dModel' ? 'default' : 'ghost'}
                            onClick={() => {
                              setActiveView('3dModel');
                              // Focus the 3D viewer after state updates
                              setTimeout(() => glbViewerRef.current?.focus(), 0);
                            }}
                            className="text-xs"
                          >
                            3D Model
                          </Button>
                          <Button
                            size="sm"
                            variant={activeView === 'sceneGraph' ? 'default' : 'ghost'}
                            onClick={() => {
                              setActiveView('sceneGraph');
                              // Focus the scene graph viewer after state updates
                              setTimeout(() => sceneGraphViewerRef.current?.focus(), 0);
                            }}
                            className="text-xs"
                          >
                            Scene Graph
                          </Button>
                        </div>

                        {/* Conditional View Rendering - Keep both mounted to preserve state */}
                        <div className={activeView === 'sceneGraph' ? 'block h-full w-full' : 'hidden'}>
                          <SceneGraphViewer ref={sceneGraphViewerRef} scenePath={selectedScene} isVisible={activeView === 'sceneGraph'} />
                        </div>
                        <div className={activeView === '3dModel' ? 'block h-full w-full' : 'hidden'}>
                          <GLBViewer ref={glbViewerRef} glbPath={glbPath} />
                        </div>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
                <ResizableHandle />
                {/* Bottom Row: 3 Columns */}
                <ResizablePanel defaultSize={50}>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50}>
                      <PDFViewer pdfPath={pdfPath} />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={25}>
                      <QAPairsViewer qaPairsPath={qaPairsPath} />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={25}>
                      <ImageGallery scenePath={selectedScene} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

const root = createRoot(document.body);
root.render(<App />);