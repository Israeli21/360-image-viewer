@echo off
REM Setup script for VGGT-SLAM integration with modelviewer (Windows with WSL)
REM This script uses Windows Subsystem for Linux (WSL) to run the bash setup

echo ==========================================
echo VGGT-SLAM Setup for ModelViewer (Windows)
echo ==========================================
echo.

REM Check if WSL is installed
wsl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: WSL is not installed.
    echo Please install WSL2 and a Linux distribution from the Microsoft Store.
    echo See: https://docs.microsoft.com/en-us/windows/wsl/install
    pause
    exit /b 1
)

echo WSL is installed. Running setup in WSL...
echo.

REM Convert Windows path to WSL path and run the bash script
wsl bash -c "cd /mnt/c/Users/isrtr/OneDrive/Desktop/Programming/Street_Viewer/modelviewer && bash setup_vggt_slam.sh"

if %errorlevel% neq 0 (
    echo.
    echo Setup failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo To run VGGT-SLAM, use WSL:
echo   wsl
echo   cd /mnt/c/Users/isrtr/OneDrive/Desktop/Programming/Street_Viewer/modelviewer
echo   conda activate vggt-slam
echo   python run_vggt_slam.py
echo.
pause
