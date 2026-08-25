import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

async function openCockpit(phase, viewport) {
  const page = await browser.newPage({viewport, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  await page.goto(`${baseUrl}/?demo=1&phase=${phase}`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("heading", {name: "Ancestral DNA map"}).waitFor({state: "visible"});
  assert.equal(await page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]").count(), 0);
  assert.equal(await page.evaluate(() => document.body.innerText.trim().length > 0), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  return {page, errors};
}

const results = [];

{
  const {page, errors} = await openCockpit("plan", {width: 1440, height: 1000});
  assert.equal(await page.locator(".interface-toggle, .intel-rail").count(), 0);
  assert.equal(await page.locator(".context-dock > button").count(), 4);
  assert.equal(await page.locator(".context-drawer").count(), 0);
  const directive = page.locator(".next-directive");
  assert.match(await directive.innerText(), /Write Tidecinder's next descendant/i);
  assert.match(await directive.innerText(), /Ancestral DNA map.*pulsing \+ node/is);
  await page.screenshot({path: "artifacts/evolving-contextual-board-desktop.png", fullPage: true});

  await directive.getByRole("button", {name: /Open evolution lab/i}).click();
  const lab = page.getByRole("dialog", {name: "Evolution lab"});
  await lab.waitFor({state: "visible"});
  assert.ok(await lab.locator(".gene-card").count() >= 8);
  const closeLab = lab.getByRole("button", {name: /Close evolution lab/i});
  assert.equal(await closeLab.evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await lab.evaluate((element) => element.contains(document.activeElement)), true);
  await page.keyboard.press("Tab");
  assert.equal(await closeLab.evaluate((element) => element === document.activeElement), true);
  await page.screenshot({path: "artifacts/evolving-contextual-lab-desktop.png", fullPage: true});
  await page.keyboard.press("Escape");
  await lab.waitFor({state: "hidden"});

  await page.locator(".phylogeny-node.node-adapt").click();
  const dossier = page.getByRole("dialog", {name: "Cindermite"});
  await dossier.waitFor({state: "visible"});
  assert.match(await dossier.innerText(), /How it evolved/i);
  await dossier.getByRole("button", {name: /Close Cindermite/i}).click();

  await page.locator(".context-dock > button", {hasText: "TURN"}).click();
  const turn = page.getByRole("dialog", {name: "Turn controls"});
  await turn.waitFor({state: "visible"});
  assert.equal(await turn.locator(".turn-loop li").count(), 4);
  assert.match(await turn.innerText(), /Ecosystem uplinks/i);
  await turn.getByRole("button", {name: /Close Turn controls/i}).click();

  await page.locator(".context-dock > button", {hasText: "EVENT"}).click();
  const event = page.getByRole("dialog", {name: "Black Drought"});
  await event.waitFor({state: "visible"});
  assert.match(await event.innerText(), /Survival trait/i);
  await event.getByRole("button", {name: /Close Black Drought/i}).click();
  results.push({scenario: "desktop contextual cockpit", errors});
  await page.close();
}

for (const [phase, expected] of [
  ["sealed", /Lock your plan — 1 action sealed/i],
  ["reveal", /Restore the key for action 1/i],
  ["expired", /Resolve natural selection now/i],
  ["locked", /Waiting for ecosystems to lock/i],
]) {
  const {page, errors} = await openCockpit(phase, {width: 1280, height: 800});
  assert.match(await page.locator(".next-directive").innerText(), expected);
  results.push({scenario: `${phase} directive`, errors});
  await page.close();
}

{
  const {page, errors} = await openCockpit("plan", {width: 390, height: 844});
  assert.equal(await page.locator(".context-dock > button").count(), 4);
  await page.screenshot({path: "artifacts/evolving-contextual-board-mobile.png", fullPage: true});
  await page.locator(".next-directive").getByRole("button", {name: /Open evolution lab/i}).click();
  const sheet = page.getByRole("dialog", {name: "Evolution lab"});
  await sheet.waitFor({state: "visible"});
  const sheetBox = await sheet.boundingBox();
  assert.ok(sheetBox && sheetBox.width <= 390 && sheetBox.height <= 844);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  await page.screenshot({path: "artifacts/evolving-contextual-cockpit-mobile.png", fullPage: true});
  results.push({scenario: "mobile contextual sheet", errors});
  await page.close();
}

for (const result of results) {
  assert.deepEqual(result.errors, [], `${result.scenario} browser errors: ${result.errors.join("\n")}`);
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
