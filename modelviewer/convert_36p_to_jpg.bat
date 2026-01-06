@echo off
REM Convert GoPro .36P files to .JPG using FFmpeg
REM Make sure FFmpeg is installed and in your PATH

setlocal enabledelayedexpansion

set INPUT_DIR=images
set OUTPUT_DIR=images

echo Converting .36P files to .JPG...
echo.

for %%f in ("%INPUT_DIR%\*.36P") do (
    set "filename=%%~nf"
    echo Converting: %%~nxf
    ffmpeg -i "%%f" -vf "scale=5760:2880" -q:v 2 "%OUTPUT_DIR%\!filename!.JPG"
    echo.
)

echo.
echo Conversion complete!
pause
