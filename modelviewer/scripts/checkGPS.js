const fs = require('fs');
const path = require('path');
const ExifParser = require('exif-parser');

const imagesDir = path.join(__dirname, '../images');
const imageFiles = [
  'IMG_2955.JPG',
  'IMG_2956.JPG',
  'IMG_2957.JPG',
  'IMG_2958.JPG',
  'IMG_2959.JPG',
  'IMG_2960.JPG',
  'IMG_2961.JPG'
];

console.log('Checking GPS data in images...\n');

imageFiles.forEach(fileName => {
  const filePath = path.join(imagesDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${fileName}: File not found`);
    return;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    
    if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
      console.log(`✅ ${fileName}:`);
      console.log(`   Latitude:  ${result.tags.GPSLatitude}`);
      console.log(`   Longitude: ${result.tags.GPSLongitude}`);
      if (result.tags.GPSAltitude) {
        console.log(`   Altitude:  ${result.tags.GPSAltitude}m`);
      }
      console.log('');
    } else {
      console.log(`⚠️  ${fileName}: No GPS data found`);
    }
  } catch (error) {
    console.log(`❌ ${fileName}: Error reading EXIF - ${error.message}`);
  }
});

console.log('\nDone!');
