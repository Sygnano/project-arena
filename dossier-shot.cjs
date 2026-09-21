const { chromium } = require("playwright");
const url = "http://localhost:3000/summoner/euw1/Sygnano-EUW";
const widths = [
  [900, 900, "900x900"],
  [1024, 768, "1024x768"],
  [1280, 860, "1280x860"],
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
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
  if ((await page.locator("text=ALL CHAMPIONS").count()) === 0) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }
  await gallery.screenshot({ path: `shot-${label}.png` });
  await page.close();
}
await browser.close();
console.log("done");
})();
