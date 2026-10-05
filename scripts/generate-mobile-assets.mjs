/**
 * Renders the native app icon, Android adaptive/monochrome icons, splash mark
 * and notification icon for apps/mobile from the PersonBrief mark (the same
 * drawing as src/components/brand.tsx and scripts/generate-app-icons.mjs).
 * Run after changing the brand: `node scripts/generate-mobile-assets.mjs`
 * (needs Playwright's Chromium; outputs are committed).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const out = path.join(root, "apps/mobile/assets/images");
const INK = "#141b2b";
const CANVAS = "#f6f4ee";
const ACCENT = "#2c56c9";
const P_PATH = "M10.5 23V9h6.2c3 0 4.9 1.7 4.9 4.4s-1.9 4.4-4.9 4.4h-3.3V23z";

function placement(size, markHeight) {
  // The P spans x 10.5–21.6 and y 9–23 on the 32 grid; centre it optically.
  const scale = (size * markHeight) / 14;
  return { scale, tx: size / 2 - 16.05 * scale + size * 0.012, ty: size / 2 - 16 * scale };
}

function gradientDefs() {
  return `<defs><radialGradient id="g" cx="30%" cy="18%" r="95%">
    <stop offset="0" stop-color="#26324f"/><stop offset="0.55" stop-color="${INK}"/><stop offset="1" stop-color="#0d1220"/>
  </radialGradient></defs>`;
}

/** The P with its accent window; one-colour versions cut the window out instead. */
function mark({ size, markHeight, fill = CANVAS, accent = ACCENT }) {
  const { scale, tx, ty } = placement(size, markHeight);
  if (!accent) {
    return `<defs><mask id="window" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff"/><rect x="13.4" y="11.6" width="5.4" height="3.6" rx="1.2" fill="#000"/>
      </mask></defs>
      <g transform="translate(${tx} ${ty}) scale(${scale})"><path d="${P_PATH}" fill="${fill}" mask="url(#window)"/></g>`;
  }
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="${P_PATH}" fill="${fill}"/>
    <rect x="13.4" y="11.6" width="5.4" height="3.6" rx="1.2" fill="${accent}"/>
  </g>`;
}

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const ASSETS = [
  // iOS / store icon: full bleed, opaque (the OS applies its own mask).
  ["icon.png", 1024, svg(1024, `${gradientDefs()}<rect width="1024" height="1024" fill="url(#g)"/>${mark({ size: 1024, markHeight: 0.5 })}`)],
  // Android adaptive icon: background layer and a foreground kept inside the 66% safe zone.
  ["adaptive-background.png", 1024, svg(1024, `${gradientDefs()}<rect width="1024" height="1024" fill="url(#g)"/>`)],
  ["adaptive-foreground.png", 1024, svg(1024, mark({ size: 1024, markHeight: 0.34 }))],
  // Android 13+ themed icon: one colour, transparent background.
  ["adaptive-monochrome.png", 1024, svg(1024, mark({ size: 1024, markHeight: 0.34, fill: "#ffffff", accent: null }))],
  // Splash mark: the rounded app icon on a transparent background.
  ["splash-icon.png", 1024, svg(1024, `${gradientDefs()}<rect width="1024" height="1024" rx="230" fill="url(#g)"/>${mark({ size: 1024, markHeight: 0.56 })}`)],
  // Android status-bar notification icon: white silhouette.
  ["notification-icon.png", 96, svg(96, mark({ size: 96, markHeight: 0.62, fill: "#ffffff", accent: null }))],
  // Web preview favicon.
  ["favicon.png", 48, svg(48, `${gradientDefs()}<rect width="48" height="48" rx="11" fill="url(#g)"/>${mark({ size: 48, markHeight: 0.56 })}`)],
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const page = await browser.newPage();
for (const [name, size, markup] of ASSETS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`);
  const opaque = name === "icon.png" || name === "adaptive-background.png";
  writeFileSync(path.join(out, name), await page.screenshot({ omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log("wrote", path.relative(root, path.join(out, name)));
}
await browser.close();
