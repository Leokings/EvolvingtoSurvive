import {chromium} from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({viewport: {width: 390, height: 844}});
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));

await page.goto("https://evolving-to-survive.vercel.app", {waitUntil: "networkidle", timeout: 120_000});
await page.getByRole("button", {name: /connect wallet/i}).click();
await page.waitForTimeout(3_000);
const dialog = page.getByRole("dialog");
const dialogInfo = await dialog.evaluate((element) => {
  const ancestry = [];
  let current = element;
  while (current && ancestry.length < 5) {
    const style = getComputedStyle(current);
    const rect = current.getBoundingClientRect();
    ancestry.push({
      tag: current.tagName,
      id: current.id,
      classes: current.className,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: rect.width,
      height: rect.height,
      dataClosed: current.getAttribute("data-closed"),
      dataOpen: current.getAttribute("data-open"),
    });
    current = current.parentElement;
  }
  return {ancestry, text: element.textContent?.trim().slice(0, 500)};
});
const result = {
  dialogCount: await dialog.count(),
  dialogWrapperVisible: await dialog.isVisible(),
  walletSheetVisible: await dialog.getByText("MetaMask", {exact: true}).isVisible(),
  walletChoices: await dialog.getByText(/MetaMask|WalletConnect|OKX Wallet/i).count(),
  dialogInfo,
  horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
  errorOverlayCount: await page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]").count(),
  errors,
};
await page.screenshot({path: "artifacts/evolving-production-mobile-final.png", fullPage: true});
await browser.close();
console.log(JSON.stringify(result, null, 2));
