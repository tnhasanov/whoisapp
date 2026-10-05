/**
 * Renders the native app icon, Android adaptive/monochrome icons, splash mark,
 * notification icon and Google Play listing graphics for apps/mobile from the
 * PersonBrief mark (the same
 * drawing as src/components/brand.tsx and scripts/generate-app-icons.mjs).
 * Run after changing the brand: `node scripts/generate-mobile-assets.mjs`
 * (needs Playwright's Chromium; outputs are committed).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// Store listing graphics (Google Play): 512 px icon and the 1024 × 500 feature graphic.
const storeOut = path.join(root, "apps/mobile/store");
// Embedded: a page set from a string cannot load file:// fonts.
const fontUrl = (file) => `data:font/ttf;base64,${readFileSync(path.join(root, "assets/fonts", file)).toString("base64")}`;
const STORE = [
  ["play-icon-512.png", 512, 512, svg(512, `${gradientDefs()}<rect width="512" height="512" fill="url(#g)"/>${mark({ size: 512, markHeight: 0.5 })}`)],
  [
    "play-feature-graphic.png",
    1024,
    500,
    `<style>
      @font-face { font-family: Serif; src: url("${fontUrl("SourceSerif4_600SemiBold.ttf")}"); }
      @font-face { font-family: Sans; src: url("${fontUrl("Inter_500Medium.ttf")}"); }
      .card { width: 1024px; height: 500px; display: flex; align-items: center; gap: 56px; padding: 0 88px; box-sizing: border-box;
        background: radial-gradient(120% 140% at 18% 12%, #26324f 0%, ${INK} 55%, #0d1220 100%); color: ${CANVAS}; }
      h1 { font: 600 76px/1 Serif; letter-spacing: -1.5px; margin: 0; }
      h1 span { color: #7f9cf0; }
      p { font: 500 27px/1.35 Sans; margin: 22px 0 0; color: #c9cfdb; max-width: 560px; }
    </style>
    <div class="card">
      <svg width="200" height="200" viewBox="0 0 200 200">${gradientDefs()}<rect width="200" height="200" rx="46" fill="url(#g)" stroke="#33405f" stroke-width="2"/>${mark({ size: 200, markHeight: 0.56 })}</svg>
      <div><h1>PersonBrief<span>.</span></h1><p>Evidence-backed briefs for professional meetings, from permitted public sources.</p></div>
    </div>`,
  ],
];

mkdirSync(out, { recursive: true });
mkdirSync(storeOut, { recursive: true });
const browser = await chromium.launch(existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const page = await browser.newPage();
for (const [name, size, markup] of ASSETS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`);
  const opaque = name === "icon.png" || name === "adaptive-background.png";
  writeFileSync(path.join(out, name), await page.screenshot({ omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log("wrote", path.relative(root, path.join(out, name)));
}
for (const [name, width, height, markup] of STORE) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><body style="margin:0">${markup}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(path.join(storeOut, name), await page.screenshot({ clip: { x: 0, y: 0, width, height } }));
  console.log("wrote", path.relative(root, path.join(storeOut, name)));
}
await browser.close();
