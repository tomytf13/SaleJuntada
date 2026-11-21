// Uses the same browser tooling as sale-juntada-e2e.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../sale-juntada-e2e/package.json", import.meta.url));
const { chromium } = require("playwright");
const asset = name => new URL("../public/" + name, import.meta.url);
const icon = await readFile(asset("pwa-icon.svg"), "utf8");
const maskable = icon.replace('rx="22"', 'rx="0"').replace("  <path", '  <g transform="translate(10 10) scale(.8)">\n  <path').replace("</svg>", "  </g>\n</svg>");
await writeFile(asset("pwa-icon-maskable.svg"), maskable);
await writeFile(asset("favicon.svg"), icon);
const browser = await chromium.launch(process.env.CI ? {} : { channel: "chrome" });
try {
  const page = await browser.newPage();
  for (const [name, svg, size] of [
    ["pwa-icon-192.png", icon, 192],
    ["pwa-icon-512.png", icon, 512],
    ["pwa-icon-maskable-512.png", maskable, 512],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + svg);
    await writeFile(asset(name), await page.screenshot({ omitBackground: true }));
  }
} finally {
  await browser.close();
}
