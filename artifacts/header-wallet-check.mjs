import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({viewport: {width: 820, height: 150}, deviceScaleFactor: 1});
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

const local = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(baseUrl);
let cssUrl = `${baseUrl}/src/styles.css`;
if (!local) {
  const htmlResponse = await page.request.get(baseUrl);
  assert.ok(htmlResponse.ok(), `Could not load ${baseUrl}`);
  const html = await htmlResponse.text();
  const asset = html.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
  assert.ok(asset, "Production HTML did not include a CSS asset");
  cssUrl = new URL(asset, `${baseUrl}/`).href;
}
await page.setContent(`
  <link rel="stylesheet" href="${cssUrl}">
  <header class="site-header">
    <span aria-hidden="true"></span>
    <div class="header-actions">
      <span class="network-pill"><i></i> Studionet</span>
      <button class="wallet-button connected" type="button">
        <span>0x5AAb…beA7</span><small>Disconnect</small>
      </button>
    </div>
  </header>`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => (
  getComputedStyle(document.querySelector(".network-pill")).minHeight === "42px"
), {timeout: 10_000});

const measurement = await page.evaluate(() => {
  const rect = (selector) => {
    const bounds = document.querySelector(selector)?.getBoundingClientRect();
    if (!bounds) throw new Error(`Missing ${selector}`);
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
      width: bounds.width,
      height: bounds.height,
      centerY: (bounds.top + bounds.bottom) / 2,
    };
  };
  return {
    network: rect(".network-pill"),
    wallet: rect(".wallet-button.connected"),
    address: rect(".wallet-button.connected > span"),
    action: rect(".wallet-button.connected > small"),
  };
});

const outerTopDelta = Math.abs(measurement.network.top - measurement.wallet.top);
const outerBottomDelta = Math.abs(measurement.network.bottom - measurement.wallet.bottom);
const internalCenterDelta = Math.abs(measurement.address.centerY - measurement.action.centerY);
console.log(JSON.stringify({measurement, outerTopDelta, outerBottomDelta, internalCenterDelta, errors}, null, 2));
assert.ok(outerTopDelta < 1, `header controls differ at the top by ${outerTopDelta}px`);
assert.ok(outerBottomDelta < 1, `header controls differ at the bottom by ${outerBottomDelta}px`);
assert.ok(internalCenterDelta < 1, `wallet labels differ at center by ${internalCenterDelta}px`);
assert.deepEqual(errors, []);

await page.screenshot({path: "artifacts/evolving-header-wallet-aligned.png"});
await browser.close();
