import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("https://evolving-to-survive.vercel.app", {waitUntil: "domcontentloaded", timeout: 30_000});
await page.getByRole("button", {name: /Connect wallet/i}).click();
const privyDialog = page.locator("#privy-dialog");
await privyDialog.waitFor({state: "attached", timeout: 30_000});
await page.getByText("Log in or sign up", {exact: true}).waitFor({state: "visible", timeout: 30_000});
const dialogState = await privyDialog.evaluate((element) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    ariaLabel: element.getAttribute("aria-label"),
    dataState: element.getAttribute("data-headlessui-state"),
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    width: rect.width,
    height: rect.height,
  };
});
const dialogText = (await privyDialog.textContent() ?? "").replace(/\s+/g, " ").trim();
assert.equal(await page.getByText("MetaMask", {exact: true}).isVisible(), true);
assert.equal(await page.getByText("WalletConnect", {exact: true}).isVisible(), true);
assert.deepEqual(errors, []);
await page.screenshot({path: "artifacts/evolving-privy-login.png", fullPage: true});

console.log(JSON.stringify({dialogState, copy: dialogText.slice(0, 180), errors}, null, 2));
await browser.close();
