// One-off generator for favicon/PWA raster assets from the brand mark.
// Re-run whenever assets/brand/icon-mark.svg changes (e.g. another brand
// color update, see docs/superpowers/specs/2026-07-20-logo-and-favicon-design.md).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'assets/brand/icon-mark.svg');

// Matches --tk-surface-sidebar / the PWA manifest's background_color — the
// warm beige the mark sits on wherever a raster format can't stay transparent.
const BG = '#F4EFE8';

async function renderTransparent(svgBuffer, size) {
  return sharp(svgBuffer).resize(size, size).png().toBuffer();
}

// Composites the mark onto a solid square canvas — for formats (apple
// touch icon, maskable PWA icon) that can't rely on transparency.
async function renderOnBackground(svgBuffer, canvasSize, markSize) {
  const mark = await sharp(svgBuffer).resize(markSize, markSize).png().toBuffer();
  const offset = Math.round((canvasSize - markSize) / 2);
  return sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: BG },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function main() {
  const svgBuffer = await readFile(svgPath);

  const [png16, png32, png48] = await Promise.all(
    [16, 32, 48].map((size) => renderTransparent(svgBuffer, size)),
  );
  const ico = await pngToIco([png16, png32, png48]);

  const appleTouchIcon = await renderOnBackground(svgBuffer, 180, 180);
  const pwa192 = await renderTransparent(svgBuffer, 192);
  const pwa512 = await renderTransparent(svgBuffer, 512);
  // Maskable icons get cropped to arbitrary shapes by the OS — keep the
  // mark inside the ~80% "safe zone" instead of filling the canvas.
  const pwaMaskable512 = await renderOnBackground(svgBuffer, 512, Math.round(512 * 0.8));

  const operatorPublic = join(root, 'frontend/operator-app/public');
  const clientPublic = join(root, 'frontend/client-portal/public');

  await Promise.all([
    writeFile(join(operatorPublic, 'favicon.ico'), ico),
    writeFile(join(clientPublic, 'favicon.ico'), ico),
    writeFile(join(operatorPublic, 'favicon.svg'), svgBuffer),
    writeFile(join(clientPublic, 'favicon.svg'), svgBuffer),
    writeFile(join(operatorPublic, 'apple-touch-icon.png'), appleTouchIcon),
    writeFile(join(operatorPublic, 'pwa-192x192.png'), pwa192),
    writeFile(join(operatorPublic, 'pwa-512x512.png'), pwa512),
    writeFile(join(operatorPublic, 'pwa-maskable-512x512.png'), pwaMaskable512),
  ]);

  console.log('Icons generated from assets/brand/icon-mark.svg.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
