# 360° Image Viewer - Navigation Guide

## Overview
The 360° Image Viewer now uses **metric-based nearest neighbor navigation** instead of sequential navigation. This means the left/right arrows navigate to the physically closest images based on their real-world positions.

## How It Works

### 1. **Nearest Neighbor Calculation**
- Uses Euclidean distance formula: `distance = √((x₂-x₁)² + (z₂-z₁)²)`
- Calculates distances from current position to all other viewpoints
- Finds the 2 closest positions and determines which is "left" vs "right" based on relative angle

### 2. **Navigation Arrows**
- **Left Arrow**: Navigates to the nearest position on the left side
- **Right Arrow**: Navigates to the nearest position on the right side
- Hover tooltips show which position you'll navigate to
- Distance indicators show the metric distance to each neighbor

### 3. **Mini-Map Visualization**
The mini-map provides visual feedback with a color-coded system:
- 🔴 **Red**: Current position
- 🟡 **Yellow**: Nearest neighbors (connected with yellow lines)
- 🟢 **Green**: Other available positions

Click any position marker on the mini-map to jump directly to that location.

## UI Features

### Distance Display
- Real-time distance indicators next to navigation arrows
- Shows metric distance in meters (or your coordinate units)
- Example: `← 25.3m` or `42.7m →`

### Position Tracking
- Header shows current position (e.g., "Position 3 of 7")
- Bottom position selector allows direct navigation to any image
- Mini-map always shows your location and nearest paths

## Understanding the Data

### Image Positions (`imagePositions.json`)
```json
{
  "IMG_2955.JPG": {
    "x": 110,
    "z": 30,
    "name": "Position 1"
  }
}
```

The coordinates should represent real-world positions:
- **x, z**: Horizontal plane coordinates (metric units recommended)
- **y**: Typically set to 0 or camera height (handled automatically)

### Integration with SLAM Systems

This UI is designed to work with various positioning systems:

#### **VGGT-SLAM** (Online/Real-time)
- Provides continuous position updates
- Minimizes drift through real-time optimization
- Can update `imagePositions.json` dynamically

#### **COLMAP** (Offline/Classical)
- Uses Structure-from-Motion (SfM)
- SIFT feature detection and matching
- Bundle adjustment optimization
- Generates static position data

Both systems output similar coordinate data, making the UI compatible with either approach.

## Project Focus

As suggested, the main focus is **UI-focused development**:

1. ✅ **Navigable Interface**: Arrows navigate to nearest positions
2. ✅ **Visual Feedback**: Mini-map shows connections and distances
3. ✅ **Metric Information**: Distance indicators for user awareness
4. ⏳ **Future**: Dynamic updates from SLAM system
5. ⏳ **Future**: Optimization as position data updates

## Testing the Navigation

### Current Image Set
Your current positions (from `imagePositions.json`):

| Image | Position (x, z) | Name |
|-------|----------------|------|
| IMG_2955.JPG | (110, 30) | Position 1 |
| IMG_2956.JPG | (50, 30) | Position 2 |
| IMG_2957.JPG | (20, 60) | Position 3 |
| IMG_2958.JPG | (90, 30) | Position 4 |
| IMG_2959.JPG | (0, 80) | Position 5 |
| IMG_2960.JPG | (65, 25) | Position 6 |
| IMG_2961.JPG | (0, 100) | Position 7 |

### Example Navigation Flow
Starting at **Position 6** (65, 25):
- **Nearest neighbors**: Position 2 (50, 30) at ~16.2m and Position 4 (90, 30) at ~25.5m
- **Left arrow** → Position 2
- **Right arrow** → Position 4

This creates a more intuitive navigation experience that follows the spatial layout rather than arbitrary file ordering.

## Development Notes

### For Future Enhancements
1. **Arrow Direction Indicators**: Point arrows toward the actual direction of neighbors
2. **3D Point Cloud Integration**: Show point cloud alongside positions
3. **Path Recording**: Record user's navigation path
4. **Measurement Tools**: Allow users to measure distances between positions
5. **Auto-routing**: Find optimal path between distant positions

### Code Structure
- `Enhanced360Viewer.tsx`: Main component with navigation logic
- `StreetViewerDemo.tsx`: Demo wrapper that loads image data
- `imagePositions.json`: Position data (can be updated by SLAM output)

### Coordinate System
- **X-Z plane**: Horizontal movement
- **Y axis**: Vertical (typically camera height, ~1.5-2m)
- **Units**: Should match your SLAM/SfM output (meters recommended)

## Summary

Your 360° viewer now provides:
- ✅ Metric-based navigation (not sequential)
- ✅ Visual distance feedback
- ✅ Interactive mini-map
- ✅ Compatibility with SLAM/SfM systems
- ✅ UI-focused user experience

This positions you well for integration with VGGT-SLAM or COLMAP outputs while maintaining a user-friendly interface for exploring 3D image spaces.
