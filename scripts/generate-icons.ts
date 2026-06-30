import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ArgusLogo } from "../src/components/ArgusLogo";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

/** Subtle outer glow — matches navbar CSS without the heavy PNG halo. */
const OUTER_GLOW_FILTER = `
  <filter id="staticGlow" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
    <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#00e5ff" flood-opacity="0.55"/>
    <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#ff1a4b" flood-opacity="0.22"/>
  </filter>`;

function emblemInner(size: number): string {
  const markup = renderToStaticMarkup(
    createElement(ArgusLogo, { size, icon: true, glow: false })
  );
  return markup
    .replace("<defs>", `<defs>${OUTER_GLOW_FILTER}`)
    .match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? markup;
}

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" filter="url(#staticGlow)">${emblemInner(64)}</svg>`;
}

/** Navbar logo is ~46px inside a 52px frame — keep the same proportion on home-screen tiles. */
function appleTouchSvg(canvas = 512): string {
  const emblemPx = Math.round(canvas * (46 / 52));
  const pad = (canvas - emblemPx) / 2;
  const scale = emblemPx / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}" fill="none">
  <rect width="${canvas}" height="${canvas}" fill="#020408"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" filter="url(#staticGlow)">${emblemInner(64)}</svg>
  </g>
</svg>`;
}

async function writePng(file: string, svg: string, size: number) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(publicDir, file));
  console.log(`Wrote public/${file} (${size}x${size})`);
}

const favicon = faviconSvg();
const apple = appleTouchSvg();

writeFileSync(join(publicDir, "favicon.svg"), favicon, "utf8");
writeFileSync(join(publicDir, "apple-touch-icon.svg"), apple, "utf8");
console.log("Wrote public/favicon.svg");
console.log("Wrote public/apple-touch-icon.svg");

await writePng("favicon-16.png", favicon, 16);
await writePng("favicon-32.png", favicon, 32);
await writePng("apple-touch-icon.png", apple, 180);
await writePng("icon-192.png", apple, 192);
await writePng("icon-512.png", apple, 512);
