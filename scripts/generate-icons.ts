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

/** App background — opaque fill prevents iOS white halo on home-screen tiles. */
const BG = { r: 2, g: 4, b: 8 };

/** Subtle outer glow — matches navbar CSS. */
const OUTER_GLOW_FILTER = `
  <filter id="staticGlow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
    <feDropShadow dx="0" dy="0" stdDeviation="0.7" flood-color="#00e5ff" flood-opacity="0.5"/>
    <feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="#ff1a4b" flood-opacity="0.2"/>
  </filter>`;

function emblemBody(size: number): string {
  const markup = renderToStaticMarkup(
    createElement(ArgusLogo, { size, icon: true, glow: false })
  );
  return markup
    .replace("<defs>", `<defs>${OUTER_GLOW_FILTER}`)
    .match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? markup;
}

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" filter="url(#staticGlow)">${emblemBody(64)}</svg>`;
}

function appleTouchSvg(canvas: number): string {
  const margin = 0.04;
  const emblemPx = canvas * (1 - 2 * margin);
  const pad = (canvas - emblemPx) / 2;
  const scale = emblemPx / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <rect width="${canvas}" height="${canvas}" fill="#020408"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" filter="url(#staticGlow)">${emblemBody(64)}</g>
</svg>`;
}

async function writePng(file: string, svg: string, size: number) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "fill" })
    .flatten({ background: BG })
    .png({ compressionLevel: 9, palette: false })
    .toFile(join(staticDir, file));
  console.log(`Wrote public/static/${file} (${size}x${size})`);
}

mkdirSync(staticDir, { recursive: true });

const favicon = faviconSvg();
const apple180 = appleTouchSvg(180);
const apple512 = appleTouchSvg(512);

writeFileSync(join(publicDir, "favicon.svg"), favicon, "utf8");

await writePng("favicon-16.png", favicon, 16);
await writePng("favicon-32.png", favicon, 32);
await writePng("favicon-48.png", favicon, 48);
await writePng("favicon-64.png", favicon, 64);
await writePng("favicon-180.png", apple180, 180);
await writePng("favicon-512.png", apple512, 512);

const ico16 = await sharp(join(staticDir, "favicon-16.png")).png().toBuffer();
const ico32 = await sharp(join(staticDir, "favicon-32.png")).png().toBuffer();
const ico48 = await sharp(join(staticDir, "favicon-48.png")).png().toBuffer();
writeFileSync(join(staticDir, "favicon.ico"), await toIco([ico16, ico32, ico48]));
console.log("Wrote public/static/favicon.ico");

// iOS also probes these legacy root paths automatically.
for (const [src, dest] of [
  ["favicon-180.png", "apple-touch-icon.png"],
  ["favicon-180.png", "apple-touch-icon-precomposed.png"],
  ["favicon.ico", "favicon.ico"],
] as const) {
  copyFileSync(join(staticDir, src), join(publicDir, dest));
}
