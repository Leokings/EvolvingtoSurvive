import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const luminance = ([r, g, b]) => {
  const linear = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const contrast = (foreground, background = [3, 13, 9]) => {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

async function open(path, viewport, readySelector) {
  const page = await browser.newPage({viewport, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${baseUrl}${path}`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.locator(readySelector).waitFor({state: "visible", timeout: 30_000});
  return {page, errors};
}

async function measure(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({state: "visible"});
  return locator.evaluate((element, evaluatedSelector) => {
    const style = getComputedStyle(element);
    return {
      selector: evaluatedSelector,
      size: Number.parseFloat(style.fontSize),
      color: style.color,
      text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80),
    };
  }, selector);
}

async function auditDirectText(page, rootSelector) {
  return page.locator(rootSelector).evaluate((root) => [...root.querySelectorAll("*")]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return !element.closest('[aria-hidden="true"]') && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    })
    .map((element) => {
      const directText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || "")
        .join(" ")
        .trim()
        .replace(/\s+/g, " ");
      const style = getComputedStyle(element);
      return {
        element: `${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`,
        text: directText.slice(0, 70),
        size: Number.parseFloat(style.fontSize),
        color: style.color,
      };
    })
    .filter((entry) => entry.text && entry.size < 9)
    .slice(0, 40));
}

const scenarios = [];

{
  const {page, errors} = await open("/?demo=1&view=lobby", {width: 1280, height: 900}, ".command-lobby");
  const selectors = [
    [".lobby-primary-nav button", 10],
    [".commander-wallet strong", 12],
    [".protocol-list small", 10],
    [".no-world-signal p", 12],
    [".campaign-biome-preview p", 11],
    [".campaign-note", 10],
    [".lobby-ticker", 9],
  ];
  const measurements = await Promise.all(selectors.map(([selector]) => measure(page, selector)));
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
    assert.ok(contrast(rgb(entry.color)) >= 4.5, `${entry.selector} contrast is below 4.5:1`);
  });
  const underNine = await auditDirectText(page, ".command-lobby");
  assert.equal(underNine.length, 0, `lobby still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "command lobby", measurements, underNine, errors});
  await page.close();
}

{
  const {page, errors} = await open("/how-to-play?demo=1&phase=plan", {width: 1440, height: 1000}, ".how-to-play");
  const selectors = [
    [".guide-hero > p", 17],
    [".guide-turn-loop li p", 11],
    [".guide-timer-card > p", 12],
    [".guide-ending-card li", 11],
    [".guide-win-condition > p", 12],
  ];
  const measurements = await Promise.all(selectors.map(([selector]) => measure(page, selector)));
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
    assert.ok(contrast(rgb(entry.color)) >= 4.5, `${entry.selector} contrast is below 4.5:1`);
  });
  const underNine = await auditDirectText(page, ".how-to-play");
  assert.equal(underNine.length, 0, `How to Play still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "How to Play page", measurements, underNine, errors});
  await page.close();
}

{
  const {page, errors} = await open("/?demo=1&phase=plan", {width: 1440, height: 1000}, ".game-cockpit");
  const boardSelectors = [
    [".roster-copy small", 10],
    [".phylogeny-label strong", 10],
    [".directive-copy strong", 17],
    [".next-directive > p", 11],
    [".context-dock small", 9],
    [".hud-event-ticker", 9],
  ];
  const boardMeasurements = await Promise.all(boardSelectors.map(([selector]) => measure(page, selector)));
  await page.locator(".next-directive").getByRole("button", {name: /Open evolution lab/i}).click();
  await page.getByRole("dialog", {name: "Evolution lab"}).waitFor({state: "visible"});
  const labSelectors = [
    [".action-protocols button small", 9],
    [".mutation-brief textarea", 11],
  ];
  const labMeasurements = await Promise.all(labSelectors.map(([selector]) => measure(page, selector)));
  const selectors = [...boardSelectors, ...labSelectors];
  const measurements = [...boardMeasurements, ...labMeasurements];
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
    assert.ok(contrast(rgb(entry.color)) >= 4.5, `${entry.selector} contrast is below 4.5:1`);
  });
  const underNine = await auditDirectText(page, ".game-cockpit");
  assert.equal(underNine.length, 0, `cockpit still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "evolution cockpit", measurements, underNine, errors});
  await page.close();
}

{
  const {page, errors} = await open("/?demo=1&phase=plan", {width: 1440, height: 1000}, ".game-cockpit");
  await page.locator(".context-dock > button", {hasText: "TURN"}).click();
  await page.getByRole("dialog", {name: "Turn controls"}).waitFor({state: "visible"});
  const selectors = [
    [".turn-loop li", 9],
    [".phase-next-command > strong", 14],
    [".phase-next-command > p", 11],
    [".phase-instruction", 11],
    [".ecosystem-readiness li", 10],
  ];
  const measurements = await Promise.all(selectors.map(([selector]) => measure(page, selector)));
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
    assert.ok(contrast(rgb(entry.color)) >= 4.5, `${entry.selector} contrast is below 4.5:1`);
  });
  const underNine = await auditDirectText(page, ".game-cockpit");
  assert.equal(underNine.length, 0, `turn drawer still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "contextual turn drawer", measurements, underNine, errors});
  await page.close();
}

{
  const {page, errors} = await open("/?demo=1&phase=plan&mode=guided&recap=1", {width: 390, height: 844}, ".era-recap");
  const selectors = [
    [".era-recap > header small", 11],
    [".era-recap-explainer", 12],
    [".era-recap-species small", 11],
    [".era-recap-grid dt", 10],
    [".era-recap > footer button", 11],
  ];
  const measurements = await Promise.all(selectors.map(([selector]) => measure(page, selector)));
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
  });
  const underNine = await auditDirectText(page, ".era-recap");
  assert.equal(underNine.length, 0, `era recap still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "era resolution recap", measurements, underNine, errors});
  await page.close();
}

{
  const {page, errors} = await open("/?demo=1&view=lobby", {width: 1280, height: 900}, ".command-lobby");
  await page.locator(".launch-campaign").click();
  await page.getByRole("dialog", {name: /Configure a hostile biosphere/i}).waitFor({state: "visible"});
  const selectors = [
    [".setup-console-header small", 9],
    [".setup-step-rail small", 9],
    [".setup-section > header small", 10],
    [".body-plan-branches label small", 10],
    [".setup-submit-bar .primary-action", 11],
  ];
  const measurements = await Promise.all(selectors.map(([selector]) => measure(page, selector)));
  measurements.forEach((entry, index) => {
    assert.ok(entry.size >= selectors[index][1], `${entry.selector} is only ${entry.size}px`);
    assert.ok(contrast(rgb(entry.color)) >= 4.5 || entry.selector.includes("primary-action"), `${entry.selector} contrast is below 4.5:1`);
  });
  const underNine = await auditDirectText(page, ".setup-console");
  assert.equal(underNine.length, 0, `setup still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  scenarios.push({name: "campaign setup", measurements, underNine, errors});
  await page.close();
}

for (const mobile of [
  {name: "mobile command lobby", path: "/?demo=1&view=lobby", root: ".command-lobby"},
  {name: "mobile evolution cockpit", path: "/?demo=1&phase=plan", root: ".game-cockpit"},
  {name: "mobile How to Play", path: "/how-to-play?demo=1&phase=plan", root: ".how-to-play"},
]) {
  const {page, errors} = await open(mobile.path, {width: 390, height: 844}, mobile.root);
  const underNine = await auditDirectText(page, mobile.root);
  assert.equal(underNine.length, 0, `${mobile.name} still has sub-9px direct text: ${JSON.stringify(underNine)}`);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, `${mobile.name} has document-level horizontal overflow`);
  scenarios.push({name: mobile.name, underNine, horizontalOverflow, errors});
  await page.close();
}

await browser.close();
for (const scenario of scenarios) assert.deepEqual(scenario.errors, [], `${scenario.name} emitted browser errors`);
console.log(JSON.stringify(scenarios, null, 2));
