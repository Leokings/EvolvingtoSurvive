import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});

async function openScenario(name, phase, viewport, mode = "guided", extraQuery = "") {
  const page = await browser.newPage({viewport, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });
  await page.goto(`${baseUrl}/?demo=1&phase=${phase}&mode=${mode}${extraQuery}`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("heading", {name: "Ancestral DNA map"}).waitFor({state: "visible", timeout: 30_000});
  assert.equal(await page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]").count(), 0);
  assert.equal(await page.locator(".game-cockpit").count(), 1);
  assert.equal(await page.locator(".site-header, .site-footer").count(), 0);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, `${name} has document-level horizontal overflow`);
  return {page, errors, horizontalOverflow};
}

const results = [];

{
  const {page, errors, horizontalOverflow} = await openScenario("era recap", "plan", {width: 1440, height: 1000}, "guided", "&recap=1");
  const recap = page.getByRole("dialog", {name: /Natural selection still happened/i});
  await recap.waitFor({state: "visible"});
  assert.match(await recap.innerText(), /Population and legacy change/i);
  assert.match(await recap.innerText(), /13m\s*→\s*9m/i);
  assert.match(await recap.innerText(), /never revealed also loses 2 population/i);
  await page.screenshot({path: "artifacts/evolving-era-recap.png", fullPage: true});
  await recap.getByRole("button", {name: /Enter era 4/i}).click();
  await recap.waitFor({state: "hidden"});
  results.push({scenario: "era resolution recap", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("guided desktop", "plan", {width: 1440, height: 1000});
  assert.equal(await page.locator(".turn-loop li").count(), 4);
  assert.equal(await page.locator("#mutation-lab").evaluate((element) => getComputedStyle(element).display), "none");
  assert.equal(await page.locator(".phase-detail-stack").evaluate((element) => getComputedStyle(element).display), "none");
  const evolveCommand = page.locator(".evolve-command-primary");
  assert.equal(await evolveCommand.count(), 1);
  await evolveCommand.click();
  await page.locator("#mutation-lab").waitFor({state: "visible"});
  assert.equal(await page.locator(".guided-lab-roadmap li").count(), 5);
  await page.screenshot({path: "artifacts/evolving-game-guided-desktop.png", fullPage: true});
  await page.getByRole("button", {name: /Close evolution controls/i}).click();
  assert.equal(await page.locator("#mutation-lab").evaluate((element) => getComputedStyle(element).display), "none");
  results.push({scenario: "guided planning desktop", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("navigation and exit", "plan", {width: 1440, height: 1000});
  assert.equal(await page.getByRole("button", {name: "Go to campaign home"}).count(), 1);
  assert.equal(await page.getByRole("button", {name: "Open How to Play"}).count(), 1);
  const endRun = page.getByRole("button", {name: /End my run/i});
  await endRun.waitFor({state: "visible"});
  await endRun.click();
  const endDialog = page.getByRole("dialog", {name: /End your run on Pyra Prime/i});
  await endDialog.waitFor({state: "visible"});
  assert.match(await endDialog.innerText(), /irreversible onchain exit/i);
  assert.match(await endDialog.innerText(), /wallet approval/i);
  await page.screenshot({path: "artifacts/evolving-end-run-confirmation.png", fullPage: true});
  await endDialog.getByRole("button", {name: /Keep playing/i}).click();
  await page.getByRole("button", {name: "Go to campaign home"}).click();
  await page.getByRole("heading", {name: "Pyra Prime"}).waitFor({state: "visible"});
  assert.equal(await page.locator(".campaign-home").count(), 1);
  assert.match(await page.locator(".home-next-mission").innerText(), /Program this era's descendants/i);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, "campaign home overflows horizontally");
  await page.screenshot({path: "artifacts/evolving-campaign-home.png", fullPage: true});
  await page.locator(".site-navigation").getByRole("button", {name: /How to play/i}).click();
  await page.getByRole("heading", {name: /Survive one era at a time/i}).waitFor({state: "visible"});
  assert.match(await page.locator(".guide-timer-card").innerText(), /Expired does not mean executed/i);
  assert.match(await page.locator(".guide-ending-card").innerText(), /End My Run is permanent/i);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, "How to Play overflows horizontally");
  await page.screenshot({path: "artifacts/evolving-how-to-play.png", fullPage: true});
  await page.goBack();
  await page.locator(".campaign-home").waitFor({state: "visible"});
  results.push({scenario: "persistent navigation + end-run confirmation", horizontalOverflow, errors});
  await page.close();
}

{
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/how-to-play?demo=1&phase=plan`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("heading", {name: /Survive one era at a time/i}).waitFor({state: "visible", timeout: 30_000});
  assert.equal(await page.locator(".site-navigation").getByRole("button", {name: /Home/i}).count(), 1);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, "mobile How to Play has document-level horizontal overflow");
  await page.screenshot({path: "artifacts/evolving-how-to-play-mobile.png", fullPage: true});
  results.push({scenario: "How to Play mobile", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("desktop", "plan", {width: 1440, height: 1000}, "advanced");
  assert.equal(await page.getByRole("heading", {name: "Your ecosystem can act"}).count(), 1);
  const lockCommand = page.getByRole("button", {name: /Lock plan · skip mutation/i});
  assert.equal(await lockCommand.count(), 1);
  const [lockBox, readinessBox] = await Promise.all([
    lockCommand.boundingBox(),
    page.locator(".readiness-heading").boundingBox(),
  ]);
  assert.ok(lockBox && readinessBox && lockBox.y < readinessBox.y, "lock-plan command is not above the readiness details");
  assert.equal(await page.locator(".phylogeny-node.node-founder").count(), 2);
  assert.equal(await page.locator(".phylogeny-node.node-next").count(), 2);
  assert.equal(await page.locator(".ancestry-wires .merge-wire").count(), 2);
  await page.locator(".phylogeny-node.node-adapt").click();
  assert.equal(await page.getByRole("heading", {name: "Cinder Carapace"}).count(), 1);
  assert.equal(await page.locator(".codex-portrait img").count(), 1);
  assert.match(await page.locator(".specimen-codex").innerText(), /How it evolved/i);

  await page.locator(".phylogeny-node.node-next.actionable").click();
  assert.equal(await page.getByRole("heading", {name: "Evolution slot open"}).count(), 1);
  await page.locator(".mutation-deck .gene-card").nth(0).click();
  await page.locator(".mutation-deck .gene-card").nth(1).click();
  await page.locator(".mutation-brief textarea").fill("Branch the selected tissues into sealable filters that keep volcanic ash outside the lungs.");
  assert.equal(await page.getByRole("button", {name: /Seal adapt/i}).isEnabled(), true);
  await page.screenshot({path: "artifacts/evolving-game-cockpit-desktop.png", fullPage: true});
  await page.getByRole("button", {name: /Seal adapt/i}).click();
  const toast = page.locator(".gameplay-frame > .toast");
  await toast.waitFor({state: "visible"});
  const [toastBox, phaseConsoleBox] = await Promise.all([
    toast.boundingBox(),
    page.locator(".intel-rail").boundingBox(),
  ]);
  assert.ok(toastBox && phaseConsoleBox && toastBox.x + toastBox.width < phaseConsoleBox.x, "transaction toast obscures the phase console");
  results.push({scenario: "planning desktop", nodes: await page.locator(".phylogeny-node").count(), horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("sealed", "sealed", {width: 1440, height: 1000}, "advanced");
  assert.equal(await page.getByRole("heading", {name: "Action sealed — now lock your plan"}).count(), 1);
  const lockCommand = page.getByRole("button", {name: /Lock plan · 1 action sealed/i});
  assert.equal(await lockCommand.count(), 1);
  const [lockBox, readinessBox] = await Promise.all([
    lockCommand.boundingBox(),
    page.locator(".readiness-heading").boundingBox(),
  ]);
  assert.ok(lockBox && readinessBox && lockBox.y < readinessBox.y, "post-commit lock command is hidden below readiness details");
  await page.screenshot({path: "artifacts/evolving-game-cockpit-sealed.png", fullPage: true});
  results.push({scenario: "action sealed but unlocked", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("expired", "expired", {width: 1440, height: 1000}, "advanced");
  assert.equal(await page.getByRole("heading", {name: "Resolve natural selection"}).count(), 1);
  assert.equal(await page.getByRole("button", {name: /Resolve era now/i}).count(), 1);
  const [advanceBox, expiredReadinessBox] = await Promise.all([
    page.getByRole("button", {name: /Resolve era now/i}).boundingBox(),
    page.locator(".readiness-heading").boundingBox(),
  ]);
  assert.ok(advanceBox && expiredReadinessBox && advanceBox.y < expiredReadinessBox.y, "expired advance command is hidden below readiness details");
  assert.match(await page.locator(".deck-lockdown").innerText(), /Resolve this era/i);
  await page.screenshot({path: "artifacts/evolving-game-cockpit-expired.png", fullPage: true});
  results.push({scenario: "expired desktop", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("reveal", "reveal", {width: 1440, height: 1000});
  assert.equal(await page.getByRole("heading", {name: "Reveal your sealed DNA"}).count(), 1);
  assert.equal(await page.getByRole("button", {name: /Restore key for action 1/i}).count(), 1);
  results.push({scenario: "reveal desktop", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("mobile", "plan", {width: 390, height: 844});
  await page.locator(".phylogeny-node.node-adapt").click();
  assert.equal(await page.getByRole("heading", {name: "Cinder Carapace"}).count(), 1);
  assert.equal(await page.locator(".codex-portrait img").count(), 1);
  assert.equal(await page.locator(".phylogeny-viewport").evaluate((element) => element.scrollWidth > element.clientWidth), true);
  await page.screenshot({path: "artifacts/evolving-game-cockpit-mobile.png", fullPage: true});
  results.push({scenario: "planning mobile", horizontalOverflow, errors});
  await page.close();
}

{
  const {page, errors, horizontalOverflow} = await openScenario("narrow mutation deck", "plan", {width: 913, height: 390}, "advanced");
  const mutationDeck = page.locator("#mutation-lab");
  await mutationDeck.scrollIntoViewIfNeeded();
  const deckLayout = await mutationDeck.evaluate((deck) => {
    const form = deck.querySelector(".mutation-console-form");
    const protocol = deck.querySelector(".action-protocols");
    const overflowingPanels = [...deck.querySelectorAll(".mutation-console-form, .mutation-console-form fieldset")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({className: element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth}));
    const escapedLabels = [...deck.querySelectorAll(".action-protocols button b, .action-protocols button small")]
      .filter((label) => {
        const button = label.closest("button");
        if (!button) return true;
        const labelRect = label.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        return labelRect.left < buttonRect.left - 1 || labelRect.right > buttonRect.right + 1;
      })
      .map((label) => label.textContent?.trim());
    return {
      cockpitHeight: getComputedStyle(deck.closest(".game-cockpit")).height,
      cockpitColumns: getComputedStyle(deck.closest(".game-cockpit")).gridTemplateColumns,
      formColumns: form ? getComputedStyle(form).gridTemplateColumns : "missing",
      protocolColumns: protocol ? getComputedStyle(protocol).gridTemplateColumns : "missing",
      overflowingPanels,
      escapedLabels,
    };
  });
  assert.equal(deckLayout.overflowingPanels.length, 0, `mutation panels overflow horizontally: ${JSON.stringify(deckLayout.overflowingPanels)}`);
  assert.equal(deckLayout.escapedLabels.length, 0, `mutation labels escaped their buttons: ${JSON.stringify(deckLayout.escapedLabels)}`);
  assert.equal(deckLayout.protocolColumns.trim().split(/\s+/).length, 1, "evolution protocols did not reflow to one column");
  assert.equal(deckLayout.cockpitColumns.trim().split(/\s+/).length, 3, "preferred three-column cockpit did not remain active at 913px");
  await mutationDeck.screenshot({path: "artifacts/evolving-mutation-deck-narrow.png"});
  results.push({scenario: "narrow mutation deck", horizontalOverflow, ...deckLayout, errors});
  await page.close();
}

{
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/?demo=1&view=lobby`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("heading", {name: /Biosphere sector/i}).waitFor({state: "visible", timeout: 30_000});
  assert.equal(await page.locator(".command-lobby").count(), 1);
  assert.equal(await page.locator(".hero-section, .site-header, .site-footer").count(), 0);
  const walletAlignment = await page.locator(".commander-wallet").evaluate((element) => {
    const address = element.querySelector("strong")?.getBoundingClientRect();
    const action = element.querySelector("em")?.getBoundingClientRect();
    return address && action ? Math.abs((address.top + address.bottom) / 2 - (action.top + action.bottom) / 2) : 999;
  });
  assert.ok(walletAlignment < 2, `wallet address and action are misaligned by ${walletAlignment}px`);
  await page.screenshot({path: "artifacts/evolving-game-command-lobby.png", fullPage: true});
  await page.locator(".launch-campaign").click();
  const dialog = page.getByRole("dialog", {name: /Configure a hostile biosphere/i});
  await dialog.waitFor({state: "visible"});
  assert.equal(await dialog.getByRole("radio").count(), 8);
  await dialog.locator(".body-plan-branches label", {hasText: "Serpentine"}).click();
  assert.equal(await dialog.getByRole("radio", {name: /Serpentine/i}).isChecked(), true);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, "species setup has document-level horizontal overflow");
  await page.screenshot({path: "artifacts/evolving-game-species-setup.png", fullPage: true});
  results.push({scenario: "game command lobby + species setup", bodyPlans: 5, walletAlignment, horizontalOverflow, errors});
  await page.close();
}

{
  const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/?demo=1&view=lobby`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("heading", {name: /Biosphere sector/i}).waitFor({state: "visible", timeout: 30_000});
  assert.equal(await page.locator(".mission-rail").evaluate((element) => getComputedStyle(element).display), "none");
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, "mobile game lobby has document-level horizontal overflow");
  await page.screenshot({path: "artifacts/evolving-game-command-lobby-mobile.png", fullPage: true});
  results.push({scenario: "game command lobby mobile", horizontalOverflow, errors});
  await page.close();
}

if (baseUrl.startsWith("https://")) {
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 1});
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/`, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.getByRole("button", {name: /Connect wallet/i}).waitFor({state: "visible", timeout: 30_000});
  assert.equal(await page.getByRole("heading", {name: /Biosphere sector/i}).count(), 1);
  assert.equal(await page.locator(".configuration-banner.warning").count(), 0, "production did not recognize the v2 deployment");
  assert.equal(await page.locator(".lobby-hud").count(), 1);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, "live Privy entry has document-level horizontal overflow");
  results.push({scenario: "live Privy entry", horizontalOverflow, errors});
  await page.close();
}

await browser.close();
for (const result of results) assert.deepEqual(result.errors, [], `${result.scenario} emitted browser errors`);
console.log(JSON.stringify(results, null, 2));
