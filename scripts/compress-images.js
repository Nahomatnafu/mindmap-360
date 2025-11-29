const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '../public/tours');
const outputDir = path.join(__dirname, '../public/tours');

const images = ['room1.jpg', 'room2.jpg', 'room3.jpg'];

async function compressImages() {
  for (const image of images) {
    const inputPath = path.join(inputDir, image);
    const outputPath = path.join(outputDir, image.replace('.jpg', '_compressed.jpg'));
    
    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${image} - file not found`);
      continue;
    }

    const stats = fs.statSync(inputPath);
    console.log(`Processing ${image} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

    try {
      await sharp(inputPath)
        .resize(4096, 2048, { // Standard equirectangular size
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 80,
          progressive: true 
        })
        .toFile(outputPath);

      const newStats = fs.statSync(outputPath);
      console.log(`  -> Compressed to ${(newStats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Replace original with compressed
      fs.unlinkSync(inputPath);
      fs.renameSync(outputPath, inputPath);
      console.log(`  -> Replaced original`);
    } catch (err) {
      console.error(`  -> Error: ${err.message}`);
    }
  }
  
  console.log('Done!');
}

compressImages();

