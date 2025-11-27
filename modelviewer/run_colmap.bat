@echo off
REM COLMAP Automatic Reconstruction Script
REM This script runs COLMAP on your extracted 2D images

echo ========================================
echo COLMAP Structure from Motion Pipeline
echo ========================================
echo.

REM Create workspace directories
echo Creating workspace directories...
if not exist "colmap_workspace" mkdir colmap_workspace
if not exist "colmap_workspace\images" mkdir colmap_workspace\images
if not exist "colmap_workspace\sparse" mkdir colmap_workspace\sparse
if not exist "colmap_workspace\dense" mkdir colmap_workspace\dense

REM Copy images
echo Copying images from src/2D_images...
xcopy /Y /I "src\2D_images\*.jpg" "colmap_workspace\images\"
xcopy /Y /I "src\2D_images\*.png" "colmap_workspace\images\" 2>nul

echo.
echo Images copied to colmap_workspace\images
echo.

REM Set COLMAP path
set COLMAP_PATH="C:\Program Files\COLMAP\bin\colmap.exe"

REM Check if COLMAP exists
if not exist %COLMAP_PATH% (
    echo ERROR: COLMAP not found at %COLMAP_PATH%
    echo.
    echo Please check your COLMAP installation
    echo.
    pause
    exit /b 1
)

echo COLMAP found at %COLMAP_PATH%
echo Starting reconstruction...
echo.
echo This will take several minutes. Please wait...
echo.

REM Run COLMAP automatic reconstruction
%COLMAP_PATH% automatic_reconstructor ^
  --workspace_path colmap_workspace ^
  --image_path colmap_workspace\images ^
  --sparse 1 ^
  --dense 0

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Reconstruction complete
    echo ========================================
    echo.
    echo Results saved to:
    echo - Sparse reconstruction: colmap_workspace\sparse\0
    echo.
    echo Next steps:
    echo 1. Export to TXT format:
    echo    colmap model_converter --input_path colmap_workspace\sparse\0 --output_path colmap_workspace\sparse\0 --output_type TXT
    echo.
    echo 2. Export point cloud:
    echo    colmap model_converter --input_path colmap_workspace\sparse\0 --output_path colmap_workspace\pointcloud.ply --output_type PLY
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Reconstruction failed
    echo ========================================
    echo.
    echo Check the error messages above for details
    echo.
)

pause
