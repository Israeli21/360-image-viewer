@echo off
REM COLMAP automatic reconstruction pipeline
REM This runs the full COLMAP pipeline from command line

set COLMAP_PATH="C:\Program Files\COLMAP\bin\colmap.exe"
set WORKSPACE=colmap_workspace
set IMAGES=src\2D_images

REM Create workspace
if not exist %WORKSPACE% mkdir %WORKSPACE%
if not exist %WORKSPACE%\database.db del %WORKSPACE%\database.db

echo ============================================================
echo COLMAP AUTOMATIC RECONSTRUCTION
echo ============================================================
echo.

echo [1/5] Feature extraction...
%COLMAP_PATH% feature_extractor ^
  --database_path %WORKSPACE%\database.db ^
  --image_path %IMAGES% ^
  --ImageReader.single_camera 1 ^
  --ImageReader.camera_model PINHOLE ^
  --SiftExtraction.max_num_features 8192 ^
  --SiftExtraction.use_gpu 0

if errorlevel 1 (
    echo ERROR: Feature extraction failed!
    pause
    exit /b 1
)

echo.
echo [2/5] Feature matching...
%COLMAP_PATH% sequential_matcher ^
  --database_path %WORKSPACE%\database.db ^
  --SiftMatching.use_gpu 0

if errorlevel 1 (
    echo ERROR: Feature matching failed!
    pause
    exit /b 1
)

echo.
echo [3/5] Sparse reconstruction...
if not exist %WORKSPACE%\sparse mkdir %WORKSPACE%\sparse
%COLMAP_PATH% mapper ^
  --database_path %WORKSPACE%\database.db ^
  --image_path %IMAGES% ^
  --output_path %WORKSPACE%\sparse ^
  --Mapper.ba_refine_focal_length 1 ^
  --Mapper.ba_refine_extra_params 1

if errorlevel 1 (
    echo ERROR: Sparse reconstruction failed!
    pause
    exit /b 1
)

echo.
echo [4/5] Exporting model...
%COLMAP_PATH% model_converter ^
  --input_path %WORKSPACE%\sparse\0 ^
  --output_path %WORKSPACE%\sparse\0 ^
  --output_type TXT

if errorlevel 1 (
    echo WARNING: Model export failed, but reconstruction may have succeeded
)

echo.
echo [5/5] Dense reconstruction (optional - can take a long time)...
echo Skip dense reconstruction? (Y/N)
set /p SKIP_DENSE=
if /i "%SKIP_DENSE%"=="Y" goto :skip_dense

if not exist %WORKSPACE%\dense mkdir %WORKSPACE%\dense
%COLMAP_PATH% image_undistorter ^
  --image_path %IMAGES% ^
  --input_path %WORKSPACE%\sparse\0 ^
  --output_path %WORKSPACE%\dense

%COLMAP_PATH% patch_match_stereo ^
  --workspace_path %WORKSPACE%\dense

%COLMAP_PATH% stereo_fusion ^
  --workspace_path %WORKSPACE%\dense ^
  --output_path %WORKSPACE%\dense\fused.ply

:skip_dense

echo.
echo ============================================================
echo COLMAP RECONSTRUCTION COMPLETE!
echo ============================================================
echo Output files:
echo   Sparse model: %WORKSPACE%\sparse\0
echo   Database: %WORKSPACE%\database.db
if exist %WORKSPACE%\dense\fused.ply echo   Dense point cloud: %WORKSPACE%\dense\fused.ply
echo.
echo You can now convert the COLMAP output to our JSON format.
pause
