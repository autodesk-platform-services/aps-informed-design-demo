/**
 * Script to generate icon.ico from Informed Design SVG logo
 * Run with: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');

// Informed Design SVG logo - with transparent background (no background rectangle)
// The viewBox is set to 1024x1024 to ensure proper centering
const svgContent = `<svg width="256" height="256" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Transparent background - no rectangle fill -->
  <g transform="translate(30, 0)">
    <path d="m156,.15l730,159.85h79.0002v864H137.0002c-28.7188,0-52-23.2812-52-52v-217.7079L154.4662,2.4109l1.5338-2.2609Z" fill="#3a3a3a"/>
    <path d="m156,0h686.0002c28.6996,0,52,23.3004,52,52v668H156V0h0Z" fill="#777676"/>
    <polygon points="0 814 156 720 156 0 0 94 0 814" fill="#d8d8d8"/>
  </g>
  <g transform="translate(30, 0)">
    <path d="m358.4331,790.9248h37.8008v151.2021h-37.8008v-151.2021Z" fill="#fff"/>
    <path d="m549.2461,790.9248v151.2021h-40.8242l-49.2495-104.3301v104.3301h-32.1846v-151.2021h44.2812l45.7925,93.7451v-93.7451h32.1846Z" fill="#fff"/>
    <path d="m698.4814,851.1895v27.8643c0,38.8809-23.7607,63.0732-68.6895,63.0732h-49.4648v-151.2021h54.6494c42.3359,0,63.5049,24.1924,63.5049,60.2646Zm-37.8008-1.2959c0-21.1689-8.6406-31.7529-26.7842-31.7529h-15.7686v96.7695h12.5283c20.0879,0,30.0244-10.7998,30.0244-34.7764v-30.2402Z" fill="#fff"/>
  </g>
  <g transform="translate(30, 0)">
    <path d="m574.8789,232.377v255.9302h51.2998v71.8198h-201.7803v-71.8198h50.7305v-255.9302h-50.7305v-71.25h201.7803v71.25h-51.2998Z" fill="#fff"/>
  </g>
</svg>`;

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Save SVG file
const svgPath = path.join(assetsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgContent);
console.log('Created icon.svg in assets folder');

console.log('\n=== MANUAL STEP REQUIRED ===');
console.log('To create the icon.ico file, please:');
console.log('1. Open https://icoconvert.com/ or https://convertico.com/');
console.log('2. Upload the file: assets/icon.svg');
console.log('3. Select sizes: 16, 32, 48, 64, 128, 256');
console.log('4. Download the ICO file and save it as: assets/icon.ico');
console.log('\nAlternatively, if you have ImageMagick installed:');
console.log('magick convert assets/icon.svg -define icon:auto-resize=256,128,64,48,32,16 assets/icon.ico');
console.log('============================\n');

// Also try to use sharp if available to create PNG versions
try {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico');
  
  const sizes = [16, 32, 48, 64, 128, 256];
  
  (async () => {
    const pngPaths = [];
    
    // Generate PNGs at each size with transparent background
    for (const size of sizes) {
      const pngPath = path.join(assetsDir, `icon-${size}.png`);
      await sharp(Buffer.from(svgContent), { density: 300 })
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
        })
        .png({ compressionLevel: 9 })
        .toFile(pngPath);
      pngPaths.push(pngPath);
      console.log(`Created icon-${size}.png with transparent background`);
    }
    
    // Create ICO from all PNG sizes for better quality at different resolutions
    const buf = await pngToIco(pngPaths);
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), buf);
    console.log('\nSuccessfully created icon.ico with transparency!');
    
    // Clean up individual PNG files
    for (const pngPath of pngPaths) {
      if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
      }
    }
    console.log('Cleaned up temporary PNG files');
  })().catch(err => {
    console.log('Could not create ICO automatically:', err.message);
  });
} catch (e) {
  console.log('Optional dependencies (sharp, png-to-ico) not installed.');
  console.log('Please follow the manual steps above to create the icon.ico file.');
}


