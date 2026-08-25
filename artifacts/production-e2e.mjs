import {chromium} from "playwright-core";

const siteUrl = "https://evolving-to-survive.vercel.app";
const workerUrl = "https://evolving-to-survive.leokings588.workers.dev";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});
page.on("requestfailed", (request) => {
  browserErrors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
});

await page.goto(siteUrl, {waitUntil: "networkidle", timeout: 120_000});
const app = {
  title: await page.title(),
  bodyTextLength: (await page.locator("body").innerText()).trim().length,
  errorOverlayCount: await page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]").count(),
  connectWalletCount: await page.getByRole("button", {name: /connect wallet/i}).count(),
  heading: await page.getByRole("heading", {level: 1}).first().innerText(),
  horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
};

const indexHtml = await (await fetch(siteUrl)).text();
const scriptPaths = Array.from(indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g), (match) => match[1]);
let productionBundleHasWorkerUrl = false;
for (const scriptPath of scriptPaths) {
  const scriptBody = await (await fetch(new URL(scriptPath, siteUrl))).text();
  if (scriptBody.includes(workerUrl)) productionBundleHasWorkerUrl = true;
}

const payload = {
  planetId: "production-smoke-20260824",
  nodeId: "founder-smoke-20260824",
  nodeKind: "founder",
  speciesOwner: "0x3333333333333333333333333333333333333333",
  speciesName: "Ashglass Grazer",
  bodyPlan: "Hexapodal grazer",
  founderDescription: "A low six-legged grazer with translucent mineral plates and wide heat-sensing frills.",
  phenotypeSummary: "Its founder form filters volcanic ash and radiates excess heat through glassy dorsal sails.",
  visualTraits: ["six articulated legs", "translucent dorsal sails", "broad ash-filtering frills"],
  ancestorUrls: [],
};

const api = await page.evaluate(async ({workerUrl: baseUrl, payload: requestBody}) => {
  const healthResponse = await fetch(`${baseUrl}/api/health`, {signal: AbortSignal.timeout(30_000)});
  const health = await healthResponse.json();
  const generationResponse = await fetch(`${baseUrl}/api/portraits/generate`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(180_000),
  });
  const generationBody = await generationResponse.text();
  if (!generationResponse.ok) {
    return {
      healthStatus: healthResponse.status,
      health,
      generationStatus: generationResponse.status,
      generationBody,
    };
  }
  const candidate = JSON.parse(generationBody);
  const imageResponse = await fetch(candidate.url, {signal: AbortSignal.timeout(30_000)});
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const digestBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const digest = `sha256:${Array.from(new Uint8Array(digestBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return {
    healthStatus: healthResponse.status,
    health,
    generationStatus: generationResponse.status,
    allowOrigin: generationResponse.headers.get("access-control-allow-origin"),
    candidate,
    imageStatus: imageResponse.status,
    imageContentType: imageResponse.headers.get("content-type"),
    imageBytes: bytes.byteLength,
    digestMatches: digest === candidate.sha256,
  };
}, {workerUrl, payload});

await page.screenshot({path: "artifacts/evolving-production-final.png", fullPage: true});

if (api.candidate?.url) {
  const imagePage = await browser.newPage({viewport: {width: 720, height: 720}});
  await imagePage.goto(api.candidate.url, {waitUntil: "load", timeout: 60_000});
  await imagePage.screenshot({path: "artifacts/evolving-generated-smoke.png", fullPage: true});
  await imagePage.close();
}

await browser.close();
console.log(JSON.stringify({app, productionBundleHasWorkerUrl, api, browserErrors}, null, 2));
