import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";
import { ArgusLogo } from "../src/components/ArgusLogo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const staticDir = join(publicDir, "static");
const BG = { r: 2, g: 4, b: 8 };

/** Clean emblem for raster export — no SVG blur/glow filters (iOS-safe). */
function emblemSvg(): string {
  const markup = renderToStaticMarkup(
    createElement(ArgusLogo, { size: 64, icon: true, glow: false })
  );
  return markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? markup;
}

function tileSvg(size: number): string {
  const margin = size * 0.04;
  const emblem = size - margin * 2;
  const scale = emblem / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#020408"/>
  <g transform="translate(${margin} ${margin}) scale(${scale})">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">${emblemSvg()}</svg>
  </g>
</svg>`;
}

async function renderMaster(size: number): Promise<Buffer> {
  return sharp(Buffer.from(tileSvg(size)))
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .flatten({ background: BG })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false, force: true })
    .toBuffer();
}

async function writePngFromMaster(file: string, master: Buffer, size: number) {
  await sharp(master)
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .flatten({ background: BG })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false, force: true })
    .toFile(join(staticDir, file));
  console.log(`Wrote public/static/${file} (${size}x${size})`);
}

mkdirSync(staticDir, { recursive: true });

writeFileSync(
  join(publicDir, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">${emblemSvg()}</svg>`,
  "utf8"
);

const master512 = await renderMaster(512);
await writePngFromMaster("favicon-512.png", master512, 512);
await writePngFromMaster("favicon-180.png", master512, 180);
await writePngFromMaster("favicon-64.png", master512, 64);
await writePngFromMaster("favicon-48.png", master512, 48);
await writePngFromMaster("favicon-32.png", master512, 32);
await writePngFromMaster("favicon-16.png", master512, 16);

// to-ico / parse-png mis-read RGB PNGs (bpp=3 but 4 bytes/pixel) → garbled BMP; force RGBA.
const icoPng = (file: string) =>
  sharp(join(staticDir, file)).ensureAlpha().png().toBuffer();
const ico16 = await icoPng("favicon-16.png");
const ico32 = await icoPng("favicon-32.png");
const ico48 = await icoPng("favicon-48.png");
writeFileSync(join(staticDir, "favicon.ico"), await toIco([ico16, ico32, ico48]));
console.log("Wrote public/static/favicon.ico");

for (const [src, dest] of [
  ["favicon-180.png", "apple-touch-icon.png"],
  ["favicon-180.png", "apple-touch-icon-precomposed.png"],
  ["favicon.ico", "favicon.ico"],
] as const) {
  copyFileSync(join(staticDir, src), join(publicDir, dest));
}
