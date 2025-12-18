import cv2
import os
from pathlib import Path

def extract_frames(video_path, output_dir, num_frames=50):
    """Extract evenly distributed frames from a video."""
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Open the video
    video = cv2.VideoCapture(video_path)
    
    if not video.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return
    
    # Get video properties
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = video.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps
    
    print(f"Video info:")
    print(f"  Total frames: {total_frames}")
    print(f"  FPS: {fps}")
    print(f"  Duration: {duration:.2f} seconds")
    print(f"  Extracting {num_frames} frames...")
    
    # Calculate frame interval
    if total_frames < num_frames:
        print(f"Warning: Video has fewer frames ({total_frames}) than requested ({num_frames})")
        num_frames = total_frames
    
    frame_interval = total_frames / num_frames
    
    # Extract frames
    extracted_count = 0
    for i in range(num_frames):
        frame_number = int(i * frame_interval)
        
        # Set video to specific frame
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        # Read the frame
        ret, frame = video.read()
        
        if ret:
            # Save the frame
            output_path = os.path.join(output_dir, f"frame_{i+1:04d}.jpg")
            cv2.imwrite(output_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            extracted_count += 1
            
            if (i + 1) % 10 == 0:
                print(f"  Extracted {i + 1}/{num_frames} frames...")
        else:
            print(f"  Warning: Could not read frame {frame_number}")
    
    # Release the video
    video.release()
    
    print(f"\nComplete! Extracted {extracted_count} frames to {output_dir}")

if __name__ == "__main__":
    video_path = "building_vid.mp4"
    output_dir = "src/2D_images"
    
    extract_frames(video_path, output_dir, num_frames=50)
