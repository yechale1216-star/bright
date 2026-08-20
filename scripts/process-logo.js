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
  const emblemSize = 420; // safe margin

  const resizedEmblem = await sharp(emblemSquare)
    .resize(emblemSize, emblemSize, { fit: 'contain', background: { r: 163, g: 73, b: 163, alpha: 1 } })
    .toBuffer();

  // Create a 512x512 solid purple (#A349A3) background canvas (full bleed)
  const basePurple = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 163, g: 73, b: 163, alpha: 1 }
    }
  }).png().toBuffer();

  // Composite emblem centered on the purple background
  const composited = await sharp(basePurple)
    .composite([{ input: resizedEmblem, gravity: 'center' }])
    .png()
    .toBuffer();

  // Also create a circular masked version for web logos
  const radius = size / 2;
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#000"/></svg>`
  );

  const circularBuffer = await sharp(composited)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Save solid full-bleed purple version for launcher icons / app icons (no white space)
  const solidTargets = [
    'c:/Users/PHOTO NATIONAL/zetimer/public/icon-512.png',
    'c:/Users/PHOTO NATIONAL/zetimer/public/icon-192.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/icon-512.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/icon-192.png',
    'c:/Users/PHOTO NATIONAL/zetimer/android/app/src/main/res/drawable/zetime_icon.png',
    'c:/Users/PHOTO NATIONAL/zetimer/android/app/src/main/res/drawable/splash.png'
  ];

  // Save circular version for web display
  const circularTargets = [
    'c:/Users/PHOTO NATIONAL/zetimer/public/addis-hiwot-logo.png',
    'c:/Users/PHOTO NATIONAL/zetimer/out/addis-hiwot-logo.png'
  ];

  for (const target of solidTargets) {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, composited);
      console.log('Saved solid purple logo to:', target);
    } catch (e) {
      console.log('Error writing to target:', target, e.message);
    }
  }

  for (const target of circularTargets) {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, circularBuffer);
      console.log('Saved circular web logo to:', target);
    } catch (e) {
      console.log('Error writing to target:', target, e.message);
    }
  }
}

processImage().catch(console.error);
