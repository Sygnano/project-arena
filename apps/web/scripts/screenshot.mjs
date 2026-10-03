// Screenshots a page of the running web app at the viewports a summoner-page slide must fit,
// and prints the PNG paths (read them to check the layout).
//
//   node scripts/screenshot.mjs <path> [--keys ArrowDown,ArrowRight] [--wait 1500] [--full] [--out dir]
//
//   <path>   e.g. summoner/euw1/Name-TAG, summoner/euw1/Name-TAG/advanced#augments, or a full URL
//   --keys   keys pressed in order before each capture, 600 ms apart. On the story recap,
//            ArrowDown starts it from the cover and each ArrowRight skips one slide.
//   --wait   ms to wait after load (and after the keys) before capturing. Default 1500.
//   --full   capture the whole scrollable page, not just the viewport.
//   --out    output folder. Default: <os temp>/arena-screens.
//
// BASE_URL overrides http://localhost:3000. Reduced motion is emulated, so entrance animations
// land on their final frame and the story's slide transitions are cross-fades.
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const VIEWPORTS = [
  { width: 390, height: 844 }, // phone
  { width: 1366, height: 768 }, // common laptop: flow mode
  { width: 1280, height: 860 }, // smallest deck mode
  { width: 1920, height: 1080 },
];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    keys: { type: "string", default: "" },
    wait: { type: "string", default: "1500" },
    full: { type: "boolean", default: false },
    out: { type: "string", default: path.join(os.tmpdir(), "arena-screens") },
  },
});

// Accepts "summoner/..." as well as "/summoner/...": Git Bash on Windows rewrites an argument
// starting with "/" into a Windows path ("C:/Program Files/Git/summoner/...").
const target = positionals[0];
if (!target || /^[a-z]:[\\/]/i.test(target)) {
  console.error("Usage: node scripts/screenshot.mjs <path, e.g. summoner/euw1/Name-TAG> [--keys k1,k2] [--wait ms]");
  console.error("(In Git Bash, leave out the leading slash.)");
  process.exit(1);
}
const url = new URL(
  /^https?:\/\//.test(target) ? target : `/${target.replace(/^\/+/, "")}`,
  process.env.BASE_URL ?? "http://localhost:3000",
).toString();
const pagePath = new URL(url).pathname + new URL(url).hash;
const keys = values.keys ? values.keys.split(",").map((key) => key.trim()) : [];
const waitMs = Number(values.wait);
const slug =
  pagePath
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "root";
const suffix = keys.length ? `-k${keys.length}` : "";

await mkdir(values.out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    // Errors the page logs are printed once (the first viewport): Next's dev overlay only
    // shows them as an "Issues" badge in the screenshot.
    if (viewport === VIEWPORTS[0]) {
      const seen = new Set();
      const report = (line) => {
        if (!seen.has(line)) console.warn(line);
        seen.add(line);
      };
      page.on("pageerror", (error) => report(`page error: ${error.message}`));
      page.on("console", (message) => {
        // Failed loads are reported with their URL below instead.
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
          report(`console error: ${message.text().slice(0, 300)}`);
        }
      });
      page.on("response", (res) => {
        if (res.status() >= 400) report(`HTTP ${res.status()}: ${res.url().slice(0, 200)}`);
      });
    }
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) console.warn(`${viewport.width}x${viewport.height}: HTTP ${response?.status()} for ${url}`);
    await page.waitForTimeout(waitMs);
    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(600);
    }
    if (keys.length) await page.waitForTimeout(waitMs);
    // Horizontal page scroll is never intended: flag it.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) console.warn(`${viewport.width}x${viewport.height}: page scrolls sideways by ${overflow}px`);
    const file = path.join(values.out, `${slug}${suffix}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: file, fullPage: values.full });
    console.log(file);
    await page.close();
  }
} finally {
  await browser.close();
}
