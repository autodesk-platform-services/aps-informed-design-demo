# Application Assets

This folder contains assets for the Electron application build.

## Required Files

### icon.ico (Windows)

You need to provide a Windows icon file named `icon.ico` for the application.

**Requirements:**
- Format: ICO (Windows Icon)
- Recommended sizes to include: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- Color depth: 32-bit (with alpha transparency)

**How to create:**
1. Create or obtain a PNG image at 256x256 or higher resolution
2. Use an online converter like https://icoconvert.com/ or https://convertico.com/
3. Or use ImageMagick: `magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`

### icon.png (Optional - for macOS/Linux)

If building for macOS or Linux in the future:
- Format: PNG
- Size: 512x512 or 1024x1024 recommended

## Placeholder

If you don't have an icon yet, the build will still work but may show a default Electron icon.
You can create a simple placeholder using any image editing tool.

