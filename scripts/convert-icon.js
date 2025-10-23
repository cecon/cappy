const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../src/assets/cappy-activity.svg');
const pngPath = path.join(__dirname, '../src/assets/icon.png');

sharp(svgPath)
  .resize(128, 128)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('✓ Icon converted successfully: src/assets/icon.png (128x128)');
  })
  .catch((err) => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
