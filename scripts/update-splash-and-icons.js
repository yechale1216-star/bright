const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, '..', 'public', 'bright-path-icon.png');
const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Density splash screen sizes (width x height)
const PORTRAIT_SPLASH_SIZES = {
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

const LANDSCAPE_SPLASH_SIZES = {
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
};

// Android mipmap sizes for launcher icons
const MIPMAP_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground sizes (108dp canvas with 72dp safe zone ~66%)
const ADAPTIVE_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function updateSplashAndIcons() {
  console.log('Using source icon:', SOURCE);
  if (!fs.existsSync(SOURCE)) {
    console.error('Source icon not found at:', SOURCE);
    process.exit(1);
  }

  // 1. Copy original bright-path-icon.png to drawable/splash.png and drawable/zetime_icon.png
  const drawableDir = path.join(RES_DIR, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

  await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(drawableDir, 'splash.png'));
  console.log('Updated drawable/splash.png (512x512)');

  await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(drawableDir, 'zetime_icon.png'));
  console.log('Updated drawable/zetime_icon.png (512x512)');

  // 2. Generate portrait splash screens
  for (const [folder, [width, height]] of Object.entries(PORTRAIT_SPLASH_SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Icon size ~45% of shortest dimension
    const iconSize = Math.round(Math.min(width, height) * 0.46);
    const iconBuffer = await sharp(SOURCE)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 } // Crisp clean white matching capacitor.config
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'centre'
      }])
      .png()
      .toFile(path.join(dir, 'splash.png'));

    console.log(`Updated ${folder}/splash.png (${width}x${height}, icon ${iconSize}x${iconSize})`);
  }

  // 3. Generate landscape splash screens
  for (const [folder, [width, height]] of Object.entries(LANDSCAPE_SPLASH_SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const iconSize = Math.round(Math.min(width, height) * 0.46);
    const iconBuffer = await sharp(SOURCE)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'centre'
      }])
      .png()
      .toFile(path.join(dir, 'splash.png'));

    console.log(`Updated ${folder}/splash.png (${width}x${height}, icon ${iconSize}x${iconSize})`);
  }

  // 4. Generate legacy launcher icons (ic_launcher.png & ic_launcher_round.png)
  for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`Updated ${folder}/ic_launcher.png and ic_launcher_round.png (${size}x${size})`);
  }

  // 5. Generate adaptive icon foregrounds (ic_launcher_foreground.png)
  for (const [folder, size] of Object.entries(ADAPTIVE_SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Safe zone for adaptive icons is ~66% of the 108dp canvas
    const iconSize = Math.round(size * 0.68);
    const iconBuffer = await sharp(SOURCE)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent canvas for foreground
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'centre'
      }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Updated ${folder}/ic_launcher_foreground.png (${size}x${size}, icon ${iconSize}x${iconSize})`);
  }

  // 6. Update ic_launcher_background.xml
  const valuesDir = path.join(RES_DIR, 'values');
  const bgPath = path.join(valuesDir, 'ic_launcher_background.xml');
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#ffffff</color>
</resources>
`;
  fs.writeFileSync(bgPath, bgXml);
  console.log('Updated values/ic_launcher_background.xml to #ffffff');

  console.log('\nAll Android splash screens and launcher icons successfully updated with bright-path-icon.png!');
}

updateSplashAndIcons().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
