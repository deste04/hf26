// Writes public/world-dots.svg, the dotted world behind every page (used as a CSS mask in globals.css).
// Run again after changing the map: node scripts/world-dots.mjs
import { writeFileSync } from "node:fs";
import DottedMap from "dotted-map";

const map = new DottedMap({ height: 60, grid: "diagonal" });
const { width, height } = map.image;
// One grid step of margin on every side, so the dots on the edges aren't cut in half.
const svg = map
  .getSVG({ radius: 0.18, color: "#000", shape: "circle", backgroundColor: "transparent" })
  .replace(/\s*\n\s*/g, "")
  .replace(/ style="[^"]*"/, "")
  .replace(/viewBox="[^"]*"/, `viewBox="-1 -1 ${width + 2} ${height + 2}"`);
writeFileSync(new URL("../public/world-dots.svg", import.meta.url), svg);
