const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.join(__dirname, '..', 'public', 'icon-512.png');
const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android mipmap sizes for launcher icons
const MIPMAP_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground sizes (108dp with padding)
const ADAPTIVE_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function generateIcons() {
  console.log('Reading source icon:', SOURCE);
  if (!fs.existsSync(SOURCE)) {
    console.error('Source icon does not exist at:', SOURCE);
    process.exit(1);
  }
  
  for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
    const outDir = path.join(RES_DIR, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // ic_launcher.png - solid purple background with emblem
    const launcherPath = path.join(outDir, 'ic_launcher.png');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', background: { r: 163, g: 73, b: 163, alpha: 1 } })
      .png()
      .toFile(launcherPath);
    console.log(`Created ${folder}/ic_launcher.png (${size}x${size})`);

    // ic_launcher_round.png - solid purple background with emblem
    const roundPath = path.join(outDir, 'ic_launcher_round.png');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover', background: { r: 163, g: 73, b: 163, alpha: 1 } })
      .png()
      .toFile(roundPath);
    console.log(`Created ${folder}/ic_launcher_round.png (${size}x${size})`);
  }

  // Generate adaptive icon foreground (icon centered on transparent canvas with safe zone padding)
  for (const [folder, size] of Object.entries(ADAPTIVE_SIZES)) {
    const outDir = path.join(RES_DIR, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // The foreground should be the icon taking ~66% of the canvas (safe zone)
    const iconSize = Math.round(size * 0.66);
    const foregroundPath = path.join(outDir, 'ic_launcher_foreground.png');
    
    // Create the icon at the safe-zone size with transparent background
    const iconBuffer = await sharp(SOURCE)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 163, g: 73, b: 163, alpha: 0 } })
      .png()
      .toBuffer();

    // Composite onto a transparent canvas of adaptive icon size
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 163, g: 73, b: 163, alpha: 0 }
      }
    })
      .composite([{
        input: iconBuffer,
        gravity: 'centre'
      }])
      .png()
      .toFile(foregroundPath);
    console.log(`Created ${folder}/ic_launcher_foreground.png (${size}x${size}, icon ${iconSize}x${iconSize})`);
  }

  // Create adaptive icon XML files
  const anydpiDir = path.join(RES_DIR, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });

  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveIconXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml);
  console.log('Created mipmap-anydpi-v26/ic_launcher.xml and ic_launcher_round.xml');

  // Create the background color resource - USE MATCHING PURPLE #A349A3 (NO WHITE SPACE!)
  const valuesDir = path.join(RES_DIR, 'values');
  const colorsPath = path.join(valuesDir, 'ic_launcher_background.xml');
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#A349A3</color>
</resources>
`;
  fs.writeFileSync(colorsPath, colorsXml);
  console.log('Created values/ic_launcher_background.xml');

  console.log('\nAll launcher icons generated successfully!');
}

generateIcons().catch(console.error);
