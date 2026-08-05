/*
 * Render the dedicated social preview page and save it as a PNG.
 */
import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const SOURCE_PATH = resolve("social-preview.html");
const OUTPUT_PATH = resolve("images/social-preview.png");

async function main() {
  await access(SOURCE_PATH);
  await mkdir(resolve("images"), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });

    await page.goto(pathToFileURL(SOURCE_PATH).href, {
      waitUntil: "load",
    });

    await page.waitForFunction(() =>
      Array.from(document.images).every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );

    await page.screenshot({
      path: OUTPUT_PATH,
      type: "png",
      fullPage: false,
    });

    console.log(`Generated ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

await main();
