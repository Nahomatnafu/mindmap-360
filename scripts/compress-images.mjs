import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const imageDirectory = path.join(scriptDirectory, '../public/tours');
const images = ['room1.jpg', 'room2.jpg', 'room3.jpg'];

async function compressImages() {
  for (const image of images) {
    const inputPath = path.join(imageDirectory, image);
    const outputPath = path.join(imageDirectory, image.replace('.jpg', '_compressed.jpg'));

    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${image} - file not found`);
      continue;
    }

    const stats = fs.statSync(inputPath);
    console.log(`Processing ${image} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

    try {
      await sharp(inputPath)
        .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toFile(outputPath);
      const newStats = fs.statSync(outputPath);
      console.log(`  -> Compressed to ${(newStats.size / 1024 / 1024).toFixed(2)} MB`);
      fs.unlinkSync(inputPath);
      fs.renameSync(outputPath, inputPath);
      console.log('  -> Replaced original');
    } catch (error) {
      console.error(`  -> Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log('Done!');
}

await compressImages();
