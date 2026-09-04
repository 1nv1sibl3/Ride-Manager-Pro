#!/usr/bin/env node
// Regenerates the brand assets from assets/logo.png:
//   app/icon.png              — favicon (Next.js file convention)
//   app/apple-icon.png        — Apple touch icon
//   public/logo.png           — in-app logo (sidebar, login)
//   app/opengraph-image.png   — social card (1200×630)
//   app/twitter-image.png     — social card (1200×630)
//
// Run after replacing the logo:  npm run icons
// The social card is deliberately text-free — sharp's SVG text rendering
// depends on system fonts and is not portable across dev machines and CI.

import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets", "logo.png");

const OG_SVG = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d4ed8"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="450" y="115" width="300" height="300" rx="56" fill="#ffffff" opacity="0.98"/>
  <rect x="470" y="465" width="260" height="16" rx="8" fill="#ffffff" opacity="0.28"/>
</svg>`;

async function main() {
  mkdirSync(path.join(ROOT, "app"), { recursive: true });
  mkdirSync(path.join(ROOT, "public"), { recursive: true });

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const outputs = [
    ["app/icon.png", 256],
    ["app/apple-icon.png", 180],
    ["public/logo.png", 512],
  ];

  for (const [file, size] of outputs) {
    await sharp(SRC)
      .resize(size, size, { fit: "contain", background: transparent })
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, file));
  }

  const mark = await sharp(SRC)
    .resize(220, 220, { fit: "contain", background: transparent })
    .png()
    .toBuffer();

  for (const name of ["opengraph-image.png", "twitter-image.png"]) {
    await sharp(Buffer.from(OG_SVG))
      .composite([{ input: mark, left: 490, top: 155 }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, "app", name));
  }

  for (const f of [...outputs.map(([file]) => file), "app/opengraph-image.png", "app/twitter-image.png"]) {
    const meta = await sharp(path.join(ROOT, f)).metadata();
    const kb = (statSync(path.join(ROOT, f)).size / 1024).toFixed(1);
    console.log(`OK  ${f}  ${meta.width}x${meta.height}  ${kb} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
