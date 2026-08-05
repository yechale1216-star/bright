const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = 'C:/Users/PHOTO NATIONAL/.gemini/antigravity-ide/brain/37ffca98-be03-4553-ab1c-8cea3411d442/media__1785921677398.png';

async function processImage() {
  // 1. Crop a square region of 410x405 centered on the emblem
  // center x = (118+426)/2 = 272, center y = (20+416)/2 = 218
  // left = 272 - 205 = 67, top = 8
  const emblemSquare = await sharp(src)
    .extract({ left: 67, top: 8, width: 410, height: 405 })
    .toBuffer();

  const size = 512;
  const emblemSize = 420; // leaves safe-zone margin inside the 512px circle

  const resizedEmblem = await sharp(emblemSquare)
    .resize(emblemSize, emblemSize, { fit: 'contain', background: { r: 163, g: 73, b: 163, alpha: 1 } })
    .toBuffer();

  // Create a 512x512 purple circle (#A349A3)
  const radius = size / 2;
  const circleSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#A349A3"/></svg>`
  );

  const baseCircle = await sharp(circleSvg).png().toBuffer();

  // Composite emblem centered on the purple circle
  const composited = await sharp(baseCircle)
    .composite([{ input: resizedEmblem, gravity: 'center' }])
    .png()
    .toBuffer();

  // Apply circular mask to ensure transparent corners outside circle
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#000"/></svg>`
  );

  const finalBuffer = await sharp(composited)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const targets = [
    'c:/Users/PHOTO NATIONAL/zetimer/public/zetime-logo.png',
    'c:/Users/PHOTO NATIONAL/zetimer/public/zetime_branding_professional.png',
    'c:/Users/PHOTO NATIONAL/zetimer/public/icon-512.png',
    'c:/Users/PHOTO NATIONAL/zetimer/public/icon-192.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/zetime-logo.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/icon-512.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/icon-192.png',
    'c:/Users/PHOTO NATIONAL/zetimer/android/app/src/main/res/drawable/zetime_icon.png',
    'c:/Users/PHOTO NATIONAL/zetimer/android/app/src/main/res/drawable/splash.png'
  ];

  for (const target of targets) {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, finalBuffer);
      console.log('Saved processed circular logo to:', target);
    } catch (e) {
      console.log('Error writing to target:', target, e.message);
    }
  }
}

processImage().catch(console.error);
