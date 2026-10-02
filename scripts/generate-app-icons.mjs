/**
 * Renders the app icons and iOS splash screens from the PersonBrief mark.
 * Run after changing the brand: `node scripts/generate-app-icons.mjs`
 * (needs Playwright's Chromium; outputs are committed so hosts need nothing extra).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const INK = "#141b2b";
const CANVAS = "#f6f4ee";
const CANVAS_DARK = "#0e121a";
const ACCENT = "#2c56c9";
const ACCENT_DARK = "#7c9dff";

// The mark from src/components/brand.tsx (32-unit grid).
const P_PATH = "M10.5 23V9h6.2c3 0 4.9 1.7 4.9 4.4s-1.9 4.4-4.9 4.4h-3.3V23z";

/** Full-bleed square icon: the OS applies its own corner mask. */
function iconSvg({ size, markHeight, background = INK, rounded = 0 }) {
  // The P spans x 10.5–21.6 and y 9–23 on the 32 grid; centre it optically.
  const scale = (size * markHeight) / 14;
  const tx = size / 2 - 16.05 * scale + size * 0.012;
  const ty = size / 2 - 16 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="g" cx="30%" cy="18%" r="95%">
        <stop offset="0" stop-color="#26324f"/>
        <stop offset="0.55" stop-color="${background}"/>
        <stop offset="1" stop-color="#0d1220"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${rounded}" fill="url(#g)"/>
    <g transform="translate(${tx} ${ty}) scale(${scale})">
      <path d="${P_PATH}" fill="${CANVAS}"/>
      <rect x="13.4" y="11.6" width="5.4" height="3.6" rx="1.2" fill="${ACCENT}"/>
    </g>
  </svg>`;
}

const SPLASH = [
  // [css width, css height, device pixel ratio]
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [414, 896, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [360, 780, 3],
  [414, 896, 2],
  [375, 667, 2],
];

function splashHtml({ width, height, dark }) {
  const icon = iconSvg({ size: 120, markHeight: 0.56, rounded: 27 });
  const fonts = path.join(root, "assets/fonts/SourceSerif4_600SemiBold.ttf");
  const font = existsSync(fonts) ? `@font-face{font-family:Brand;src:url(data:font/ttf;base64,${readFileSync(fonts).toString("base64")})}` : "";
  return `<!doctype html><html><head><style>${font}
    html,body{margin:0;width:${width}px;height:${height}px;background:${dark ? CANVAS_DARK : CANVAS};}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Brand,Georgia,serif}
    .icon{width:120px;height:120px;border-radius:27px;box-shadow:${dark ? "0 0 0 1px rgb(255 255 255 / 0.09), 0 18px 40px rgb(0 0 0 / 0.55)" : "0 18px 40px rgb(20 27 43 / 0.18)"}}
    .name{font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${dark ? "#e8ebf1" : INK}}
    .dot{color:${dark ? ACCENT_DARK : ACCENT}}
  </style></head><body><div class="icon">${icon}</div><div class="name">PersonBrief<span class="dot">.</span></div></body></html>`;
}

const browser = await chromium.launch(existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const page = await browser.newPage();

async function renderSvg(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log("wrote", path.relative(root, file));
}

mkdirSync(path.join(root, "public/icons"), { recursive: true });
mkdirSync(path.join(root, "public/splash"), { recursive: true });
await renderSvg(iconSvg({ size: 512, markHeight: 0.5 }), 512, path.join(root, "public/icons/icon-512.png"));
await renderSvg(iconSvg({ size: 192, markHeight: 0.5 }), 192, path.join(root, "public/icons/icon-192.png"));
// Maskable: the mark stays inside the 80% safe zone.
await renderSvg(iconSvg({ size: 512, markHeight: 0.38 }), 512, path.join(root, "public/icons/icon-maskable-512.png"));
await renderSvg(iconSvg({ size: 96, markHeight: 0.5 }), 96, path.join(root, "public/icons/shortcut-96.png"));
// Apple touch icon and favicon source (Next.js file conventions).
await renderSvg(iconSvg({ size: 180, markHeight: 0.5 }), 180, path.join(root, "src/app/apple-icon.png"));
await renderSvg(iconSvg({ size: 64, markHeight: 0.56, rounded: 14 }), 64, path.join(root, "src/app/icon.png"));

for (const [w, h, dpr] of SPLASH) {
  for (const dark of [false, true]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await p.setContent(splashHtml({ width: w, height: h, dark }));
    await p.evaluate(() => document.fonts.ready);
    const file = path.join(root, `public/splash/splash-${w * dpr}x${h * dpr}${dark ? "-dark" : ""}.png`);
    writeFileSync(file, await p.screenshot());
    await p.close();
    console.log("wrote", path.relative(root, file));
  }
}
await browser.close();
