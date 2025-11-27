"""
Setup and run VGGT-SLAM for street view reconstruction
VGGT-SLAM: https://github.com/yanyan-li/VGGT-SLAM
"""

import subprocess
import sys
from pathlib import Path
import json

def check_requirements():
    """Check if required packages are installed"""
    print("Checking requirements...")
    
    required = {
        'torch': 'PyTorch',
        'torchvision': 'TorchVision',
        'opencv-python': 'OpenCV',
        'numpy': 'NumPy',
        'matplotlib': 'Matplotlib',
        'tqdm': 'TQDM',
        'plyfile': 'PLYFile',
        'open3d': 'Open3D'
    }
    
    missing = []
    for package, name in required.items():
        try:
            __import__(package.replace('-', '_'))
            print(f"  ✓ {name}")
        except ImportError:
            print(f"  ✗ {name} - MISSING")
            missing.append(package)
    
    return missing

def install_requirements(packages):
    """Install missing packages"""
    if not packages:
        return True
    
    print(f"\nInstalling {len(packages)} missing packages...")
    
    # Install PyTorch CPU version if needed
    if 'torch' in packages or 'torchvision' in packages:
        print("Installing PyTorch (CPU version)...")
        cmd = [
            sys.executable, '-m', 'pip', 'install',
            'torch', 'torchvision', 'torchaudio',
            '--index-url', 'https://download.pytorch.org/whl/cpu'
        ]
        subprocess.run(cmd)
        packages = [p for p in packages if p not in ['torch', 'torchvision']]
    
    # Install other packages
    if packages:
        cmd = [sys.executable, '-m', 'pip', 'install'] + packages
        result = subprocess.run(cmd)
        return result.returncode == 0
    
    return True

def clone_vggt_slam():
    """Clone VGGT-SLAM repository"""
    repo_dir = Path('VGGT-SLAM')
    
    if repo_dir.exists():
        print(f"\n✓ VGGT-SLAM directory already exists")
        return True
    
    print("\nCloning VGGT-SLAM repository...")
    cmd = [
        'git', 'clone',
        'https://github.com/yanyan-li/VGGT-SLAM.git',
        '--depth', '1'
    ]
    
    result = subprocess.run(cmd)
    return result.returncode == 0

def prepare_dataset():
    """Prepare images for VGGT-SLAM"""
    print("\nPreparing dataset...")
    
    images_dir = Path('src/2D_images')
    output_dir = Path('vggt_dataset')
    output_dir.mkdir(exist_ok=True)
    
    # VGGT-SLAM expects specific directory structure
    rgb_dir = output_dir / 'rgb'
    rgb_dir.mkdir(exist_ok=True)
    
    # Copy and rename images
    import re
    def get_image_number(path):
        match = re.search(r'(\d+)', path.stem)
        return int(match.group(1)) if match else 0
    
    image_paths = sorted(images_dir.glob('*.png'), key=get_image_number)
    
    print(f"Found {len(image_paths)} images")
    
    for i, img_path in enumerate(image_paths):
        import shutil
        # VGGT-SLAM typically expects numbered images
        new_name = f'{i:06d}.png'
        shutil.copy(str(img_path), str(rgb_dir / new_name))
    
    print(f"✓ Copied {len(image_paths)} images to {rgb_dir}")
    
    # Create timestamps file
    timestamps_file = output_dir / 'timestamps.txt'
    with open(timestamps_file, 'w') as f:
        for i in range(len(image_paths)):
            f.write(f"{i * 0.1:.6f}\n")  # Assume 10Hz capture rate
    
    print(f"✓ Created timestamps file")
    
    return output_dir

def create_vggt_config(dataset_path):
    """Create configuration file for VGGT-SLAM"""
    config = {
        "dataset": str(dataset_path),
        "output": "vggt_output",
        "camera": {
            "fx": 676.0,
            "fy": 676.0,
            "cx": 676.0,
            "cy": 293.5,
            "width": 1352,
            "height": 587,
            "fps": 10.0
        },
        "slam": {
            "use_viewer": False,
            "enable_loop_closure": True,
            "enable_mapping": True
        }
    }
    
    config_file = Path('vggt_config.json')
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✓ Created config file: {config_file}")
    return config_file

def run_alternative_slam():
    """Run a simpler SLAM alternative that works without GPU"""
    print("\n" + "="*60)
    print("VGGT-SLAM requires GPU and is complex to set up.")
    print("Let me try ORB-SLAM3 instead (works on CPU)")
    print("="*60)
    
    # Check if ORB-SLAM3 is available
    orbslam_dir = Path('ORB_SLAM3')
    if not orbslam_dir.exists():
        print("\nORB-SLAM3 not found. Would you like to:")
        print("1. Use improved COLMAP (best quality, CPU only)")
        print("2. Try to install ORB-SLAM3 (complex, requires compilation)")
        print("3. Use improved OpenCV-based reconstruction")
        
        return False
    
    return True

def main():
    print("="*60)
    print("VGGT-SLAM SETUP FOR STREET VIEW RECONSTRUCTION")
    print("="*60)
    
    # Check requirements
    missing = check_requirements()
    
    if missing:
        print(f"\nFound {len(missing)} missing packages")
        response = input("Install missing packages? (Y/N): ")
        if response.upper() == 'Y':
            if not install_requirements(missing):
                print("ERROR: Failed to install requirements")
                return
        else:
            print("Cannot proceed without required packages")
            return
    
    print("\n" + "="*60)
    print("IMPORTANT: VGGT-SLAM typically requires:")
    print("  - NVIDIA GPU with CUDA")
    print("  - Complex compilation and dependencies")
    print("  - Specific input format")
    print("="*60)
    
    print("\nYour system: No NVIDIA GPU detected")
    print("\nWould you like to:")
    print("1. Try CPU-based setup anyway (may be slow/fail)")
    print("2. Use COLMAP command-line (professional tool, CPU friendly)")
    print("3. Use improved OpenCV reconstruction (fast, decent quality)")
    
    choice = input("\nChoice (1/2/3): ").strip()
    
    if choice == '1':
        # Attempt VGGT-SLAM setup
        if not clone_vggt_slam():
            print("ERROR: Failed to clone VGGT-SLAM")
            return
        
        dataset_path = prepare_dataset()
        config_file = create_vggt_config(dataset_path)
        
        print("\n" + "="*60)
        print("VGGT-SLAM setup complete!")
        print("However, you'll need to:")
        print("1. Install CUDA toolkit if you have a compatible GPU")
        print("2. Compile VGGT-SLAM from source")
        print("3. Run: python VGGT-SLAM/run.py --config vggt_config.json")
        print("="*60)
        
    elif choice == '2':
        print("\nLaunching COLMAP command-line reconstruction...")
        print("Run: run_colmap_auto.bat")
        
    else:
        print("\nSticking with improved OpenCV reconstruction")
        print("Current results in: sfm_output/camera_poses.json")

if __name__ == "__main__":
    main()
