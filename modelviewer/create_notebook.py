import json

notebook = {
    "cells": [
        {"cell_type": "markdown", "metadata": {}, "source": ["# VGGT-SLAM GPU Reconstruction\n", "Runtime → GPU → Run all → Upload images → Download"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 1. Check GPU"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["import torch\n", "print(f'GPU: {torch.cuda.is_available()}')\n", "if torch.cuda.is_available():\n", "    print(torch.cuda.get_device_name(0))"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 2. Install Dependencies"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["!apt-get update -qq && apt-get install -y -qq git libboost-all-dev cmake gcc g++ > /dev/null 2>&1\n", "print('✅ Done')"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 3. Setup VGGT-SLAM"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["import os\n", "if not os.path.exists('VGGT-SLAM'):\n", "    !git clone https://github.com/MIT-SPARK/VGGT-SLAM.git\n", "    print('✅ Cloned')\n", "else:\n", "    print('✅ Exists')"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["%%bash\n", "cd VGGT-SLAM\n", "chmod +x setup.sh\n", "./setup.sh"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 4. Upload Images"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["from google.colab import files\n", "import zipfile, os\n", "os.makedirs('input_images', exist_ok=True)\n", "print('📤 Upload ZIP')\n", "uploaded = files.upload()\n", "for f in uploaded:\n", "    if f.endswith('.zip'):\n", "        with zipfile.ZipFile(f) as z:\n", "            z.extractall('input_images')\n", "        os.remove(f)\n", "imgs = [f for f in os.listdir('input_images') if f.lower().endswith(('.jpg','.png'))]\n", "print(f'✅ {len(imgs)} images')"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 5. Run VGGT-SLAM (30-40 min)"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["%%bash\n", "cd VGGT-SLAM\n", "mkdir -p ../vggt_logs\n", "echo '🚀 Starting...'\n", "python3 main.py --image_folder ../input_images --max_loops 3 --conf_threshold 25.0 --log_results --log_path ../vggt_logs/poses.txt\n", "echo '✅ Done'"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 6. Export Point Cloud"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["import glob, os, shutil\n", "pcd_files = glob.glob('vggt_logs/pointcloud_*.pcd')\n", "if not pcd_files:\n", "    print('❌ No clouds')\n", "else:\n", "    print(f'✅ {len(pcd_files)} clouds')\n", "    pts, cols = [], []\n", "    for pcd in sorted(pcd_files):\n", "        with open(pcd) as f:\n", "            data = False\n", "            for line in f:\n", "                if line.startswith('DATA'):\n", "                    data = True\n", "                    continue\n", "                if data and line.strip():\n", "                    p = line.split()\n", "                    if len(p) >= 6:\n", "                        pts.append([float(p[0]), float(p[1]), float(p[2])])\n", "                        cols.append([int(p[3]), int(p[4]), int(p[5])])\n", "    print(f'✅ {len(pts):,} points')\n", "    os.makedirs('vggt_output', exist_ok=True)\n", "    ply = 'vggt_output/point_cloud.ply'\n", "    with open(ply, 'w') as f:\n", "        f.write('ply\\n')\n", "        f.write('format ascii 1.0\\n')\n", "        f.write(f'element vertex {len(pts)}\\n')\n", "        f.write('property float x\\n')\n", "        f.write('property float y\\n')\n", "        f.write('property float z\\n')\n", "        f.write('property uchar red\\n')\n", "        f.write('property uchar green\\n')\n", "        f.write('property uchar blue\\n')\n", "        f.write('end_header\\n')\n", "        for (x,y,z), (r,g,b) in zip(pts, cols):\n", "            f.write(f'{x} {y} {z} {r} {g} {b}\\n')\n", "    if os.path.exists('vggt_logs/poses.txt'):\n", "        shutil.copy('vggt_logs/poses.txt', 'vggt_output/camera_poses.txt')\n", "    print(f'✅ PLY: {os.path.getsize(ply)/1024/1024:.1f} MB')"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## 7. Download"]},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": ["import zipfile\n", "from google.colab import files\n", "with zipfile.ZipFile('vggt_slam_output.zip', 'w') as z:\n", "    for root, dirs, fnames in os.walk('vggt_output'):\n", "        for f in fnames:\n", "            z.write(os.path.join(root,f), f)\n", "            print(f'  {f}')\n", "print(f'✅ {os.path.getsize(\"vggt_slam_output.zip\")/1024/1024:.1f} MB')\n", "files.download('vggt_slam_output.zip')\n", "print('✅ DONE')"]}
    ],
    "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4"}, "kernelspec": {"display_name": "Python 3", "name": "python3"}},
    "nbformat": 4,
    "nbformat_minor": 0
}

with open('VGGT_SLAM_Reconstruction.ipynb', 'w') as f:
    json.dump(notebook, f, indent=1)

print("✅ Created VGGT_SLAM_Reconstruction.ipynb")
