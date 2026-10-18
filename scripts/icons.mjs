// Writes the favicons from src/app/icon.svg: favicon.ico (16, 32, 48), apple-icon.png and the manifest's PNGs.
// Run again after changing the mark: node scripts/icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
// Apple and Android round or mask the corners themselves: a square tile with the glyph kept inside the safe zone.
const square = svg
  .replace('rx="8"', 'rx="0"')
  .replace(/<svg([^>]*)viewBox="0 0 32 32"/, '<svg$1viewBox="-4 -4 40 40"')
  .replace('<rect width="32" height="32"', '<rect x="-4" y="-4" width="40" height="40"');

const png = (source, size) => sharp(Buffer.from(source), { density: (72 * size) / 32 }).resize(size, size).png().toBuffer();

// An ICO is a directory of PNGs: a 6-byte header, a 16-byte entry per image, then the images.
async function ico(sizes) {
  const images = await Promise.all(sizes.map((size) => png(svg, size)));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(sizes[i] % 256, entry);
    header.writeUInt8(sizes[i] % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}

const out = (path) => new URL(path, import.meta.url);
writeFileSync(out("../src/app/favicon.ico"), await ico([16, 32, 48]));
writeFileSync(out("../src/app/apple-icon.png"), await png(square, 180));
writeFileSync(out("../public/icon-192.png"), await png(square, 192));
writeFileSync(out("../public/icon-512.png"), await png(square, 512));
