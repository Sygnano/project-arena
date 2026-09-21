const { chromium } = require("playwright");

const url = "http://localhost:3000/summoner/euw1/Sygnano-EUW";
const widths = [
  [900, 900, "900x900"],
  [1024, 768, "1024x768"],
  [1280, 900, "1280x900"],
];

(async () => {
const browser = await chromium.launch();
for (const [w, h, label] of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  // Deep-link straight to the collection section then open the first card.
  await page.evaluate(() => {
    document.getElementById("collection")?.scrollIntoView();
  });
  await page.waitForTimeout(500);

  // Click the first champion card in the coverflow gallery.
  const card = page.locator('[id="collection"] img, [id="collection"] button, [id="collection"] [role="button"]').first();
  // Try to find and click a champion card - fall back to clicking the centered card container.
  const gallery = page.locator("#collection");
  await gallery.scrollIntoViewIfNeeded();

  // Click roughly the center of the gallery to activate the centered card.
  const box = await gallery.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(600);

  // If dossier didn't open (single click just centers), press Enter to activate.
  const hasBackButton = await page.locator("text=ALL CHAMPIONS").count();
  if (hasBackButton === 0) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: `dossier-${label}.png`, fullPage: false });

  // Also screenshot just the collection section.
  await gallery.screenshot({ path: `dossier-section-${label}.png` }).catch(() => {});

  console.log(`[${label}] hasBackButton after attempts:`, await page.locator("text=ALL CHAMPIONS").count());
  console.log(`[${label}] console errors:`, errors.slice(0, 5));

  await page.close();
}
await browser.close();
console.log("done");
})();
