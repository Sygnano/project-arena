const { chromium } = require("playwright");

const url = "http://localhost:3000/summoner/euw1/Sygnano-EUW";
const widths = [
  [900, 900, "900x900"],
  [1024, 768, "1024x768"],
  [1280, 900, "1280x900"],
  [1280, 860, "1280x860"],
  [1920, 1080, "1920x1080"],
];

(async () => {
const browser = await chromium.launch();
for (const [w, h, label] of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#collection", { timeout: 30000 });
  await page.locator("#collection").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const gallery = page.locator("#collection");
  const box = await gallery.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(600);
  if ((await page.locator("text=ALL CHAMPIONS").count()) === 0) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }

  // Measure the actual layout: collection section bounding box vs. the next
  // sibling section's top, and whether the panel content overflows visibly.
  const info = await page.evaluate(() => {
    const section = document.getElementById("collection");
    const next = section?.nextElementSibling;
    const panel = null;
    const statGrid = section?.querySelector('.content-start');
    return {
      sectionRect: section?.getBoundingClientRect(),
      nextRect: next?.getBoundingClientRect(),
      statGridRect: statGrid?.getBoundingClientRect(),
      statGridScrollHeight: statGrid?.scrollHeight,
      statGridClientHeight: statGrid?.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
    };
  });
  console.log(`[${label}]`, JSON.stringify(info, null, 2));

  await page.screenshot({ path: `dossier-full-${label}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log("done");
})();
