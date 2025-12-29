"""
Resize all 2D_images to a consistent size for VGGT-SLAM
"""
from PIL import Image
import os
from pathlib import Path

INPUT_DIR = Path(__file__).parent / "src" / "2D_images"
OUTPUT_DIR = Path(__file__).parent / "2D_images_resized"
TARGET_SIZE = (1920, 1080)  # Standard HD size

print(f"Resizing images from {INPUT_DIR}")
print(f"Target size: {TARGET_SIZE}\n")

OUTPUT_DIR.mkdir(exist_ok=True)

images = sorted([f for f in os.listdir(INPUT_DIR) if f.endswith('.jpg')])

for img_file in images:
    img_path = INPUT_DIR / img_file
    img = Image.open(img_path)
    
    # Resize maintaining aspect ratio, then pad/crop to exact size
    img_resized = img.resize(TARGET_SIZE, Image.LANCZOS)
    
    output_path = OUTPUT_DIR / img_file
    img_resized.save(output_path, quality=95)
    
    print(f"✓ {img_file}: {img.size} → {TARGET_SIZE}")

print(f"\n✅ Resized {len(images)} images")
print(f"Output: {OUTPUT_DIR}")
