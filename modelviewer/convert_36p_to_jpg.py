"""
Convert GoPro .36P files to .JPG format
Requires: ffmpeg-python or subprocess with ffmpeg installed
"""

import os
import subprocess
from pathlib import Path
import shutil

def find_ffmpeg():
    """Find FFmpeg executable in common Windows locations"""
    # First, try to find it in PATH
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        return ffmpeg_path
    
    # Common Windows installation paths
    common_paths = [
        r'C:\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe',
    ]
    
    # Also check in user's local app data
    local_app_data = os.environ.get('LOCALAPPDATA', '')
    if local_app_data:
        common_paths.extend([
            os.path.join(local_app_data, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg*', 'ffmpeg-*', 'bin', 'ffmpeg.exe'),
        ])
    
    for path in common_paths:
        # Handle wildcards
        if '*' in path:
            from glob import glob
            matches = glob(path)
            if matches:
                return matches[0]
        elif os.path.exists(path):
            return path
    
    return None

def convert_36p_to_jpg(input_dir='images', output_dir='images', quality=2):
    """
    Convert all .36P files in input_dir to .JPG in output_dir
    
    Args:
        input_dir: Directory containing .36P files
        output_dir: Directory to save .JPG files
        quality: JPEG quality (1-31, lower is better, 2 is high quality)
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Find all .36P files
    p36_files = list(input_path.glob('*.36P'))
    
    if not p36_files:
        print(f"No .36P files found in {input_dir}")
        return
    
    print(f"Found {len(p36_files)} .36P files to convert")
    print("-" * 50)
    
    # Find FFmpeg
    ffmpeg_cmd = find_ffmpeg()
    if not ffmpeg_cmd:
        print("✗ FFmpeg not found. Please install FFmpeg:")
        print("  - Download from: https://ffmpeg.org/download.html")
        print("  - Or use: winget install ffmpeg")
        print("  - Then restart your terminal")
        return
    
    print(f"Using FFmpeg: {ffmpeg_cmd}")
    print("-" * 50)
    
    for p36_file in p36_files:
        output_file = output_path / f"{p36_file.stem}.JPG"
        
        print(f"Converting: {p36_file.name} -> {output_file.name}")
        
        try:
            # FFmpeg command to extract first frame from .36P
            cmd = [
                ffmpeg_cmd,
                '-i', str(p36_file),
                '-vf', 'scale=5760:2880',  # GoPro MAX resolution
                '-frames:v', '1',  # Extract only first frame
                '-q:v', str(quality),
                '-y',  # Overwrite output file
                str(output_file)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✓ Successfully converted {p36_file.name}")
            else:
                print(f"✗ Error converting {p36_file.name}")
                print(f"  Error: {result.stderr}")
        
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print("-" * 50)
    print(f"Conversion complete! Check {output_dir} for .JPG files")

if __name__ == '__main__':
    convert_36p_to_jpg()
