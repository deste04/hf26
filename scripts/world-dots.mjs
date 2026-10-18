// Writes public/world-dots.svg, the dotted world behind every page (used as a CSS mask in globals.css).
// Run again after changing the map: node scripts/world-dots.mjs
import { writeFileSync } from "node:fs";
import DottedMap from "dotted-map";

const map = new DottedMap({ height: 60, grid: "diagonal" });
const { width, height } = map.image;
// A margin so the dots on the edges aren't cut in half: one grid step at the sides and bottom, just a dot at the top,
// where the map meets the top of the page.
const svg = map
  .getSVG({ radius: 0.18, color: "#000", shape: "circle", backgroundColor: "transparent" })
  .replace(/\s*\n\s*/g, "")
  .replace(/ style="[^"]*"/, "")
  .replace(/viewBox="[^"]*"/, `viewBox="-1 -0.25 ${width + 2} ${height + 1.25}"`);
writeFileSync(new URL("../public/world-dots.svg", import.meta.url), svg);
