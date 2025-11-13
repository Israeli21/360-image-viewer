# 360° Image Viewer

A desktop application for viewing and navigating through 360° panoramic images, built with Electron, React, and Three.js.

## Features

- 🔄 Interactive 360° panoramic image viewing
- 🖱️ Drag to look around in all directions
- 📱 Touch support for tablets and touch screens
- ⬅️➡️ Navigate between multiple 360° images
- 🎨 Modern UI with Shadcn components

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI library with TypeScript
- **Three.js** - 3D rendering and 360° sphere visualization
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd modelviewer
```

2. Install dependencies:
```bash
npm install
```

3. Add your 360° images:
   - Place your 360° panoramic images (JPG format) in the `images/` folder
   - Update the image filenames in `src/StreetViewerDemo.tsx`

### Running the App

Development mode:
```bash
npm run start
```

Build for production:
```bash
npm run make
```

## Project Structure

```
modelviewer/
├── components/          # React components
│   ├── Enhanced360Viewer.tsx    # Main 360° viewer component
│   └── ui/             # Shadcn UI components
├── src/                # Application source
│   ├── app.tsx         # Main app component
│   ├── StreetViewerDemo.tsx    # Demo implementation
│   └── styles/         # Global styles
├── images/             # 360° panoramic images
└── webpack.*.ts        # Webpack configuration
```

## How It Works

The viewer uses Three.js to create an inverted sphere geometry with your 360° image as a texture. The camera is positioned at the center of the sphere, allowing users to look around in all directions by dragging with their mouse or touch.

## License

MIT
