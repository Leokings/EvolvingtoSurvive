import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({viewport: {width: 1320, height: 760}, deviceScaleFactor: 1});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(`${baseUrl}/?demo=1&view=lobby`, {waitUntil: "domcontentloaded", timeout: 30_000});
await page.getByRole("heading", {name: /Biosphere sector/i}).waitFor({state: "visible", timeout: 30_000});
await page.locator("#root").evaluate((root) => {
  const details = (status) => `
    <div class="species-details">
      <div class="species-heading">
        <div><small>Your species</small><h2>Serpenhuge</h2></div>
        <span>0 evolutions</span>
      </div>
      <p>Gigantic snake-type creatures adapted to a hostile frontier.</p>
      <div class="population-line"><span><small>Population</small><strong>12m</strong></span><i><b style="width:100%"></b></i></div>
      <div class="species-stat-row">
        <span><small>Best trait</small><strong>Resilience 3</strong></span>
        <span><small>Genes</small><strong>8</strong></span>
        <span><small>Legacy</small><strong>0</strong></span>
      </div>
      <small class="portrait-state ${status}">Portrait: ${status}</small>
    </div>`;
  root.innerHTML = `
    <main style="min-height:100vh;padding:34px;background:#04100c">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1240px;margin:0 auto">
        <article class="species-panel your-species" data-state="pending">
          <div class="species-portrait"><div class="creature-silhouette serpentine" aria-hidden="true"><span class="creature-core"></span><i class="limb limb-one"></i><i class="limb limb-two"></i><i class="limb limb-three"></i><i class="limb limb-four"></i><b class="creature-eye"></b><em class="creature-ridge"></em></div><span>Founder lineage</span></div>
          ${details("pending")}
        </article>
        <article class="species-panel your-species" data-state="accepted">
          <div class="species-portrait"><img src="/images/cindermite-cinder-carapace.png" alt="Serpenhuge, canonical phenotype"><span>Founder lineage</span></div>
          ${details("accepted")}
        </article>
      </div>
    </main>`;
});
await page.locator('[data-state="accepted"] img').waitFor({state: "visible", timeout: 10_000});

const measurements = await page.locator(".species-panel").evaluateAll((cards) => cards.map((card) => {
  const rect = (selector) => {
    const box = card.querySelector(selector)?.getBoundingClientRect();
    return box ? {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height} : null;
  };
  const statCells = [...card.querySelectorAll(".species-stat-row > span")].map((element) => {
    const box = element.getBoundingClientRect();
    return {left: box.left, right: box.right, width: box.width};
  });
  const cardBox = card.getBoundingClientRect();
  return {
    card: {left: cardBox.left, right: cardBox.right, top: cardBox.top, bottom: cardBox.bottom, width: cardBox.width, height: cardBox.height},
    title: rect(".species-heading h2"),
    evolution: rect(".species-heading > span"),
    populationLabel: rect(".population-line small"),
    populationValue: rect(".population-line strong"),
    statCells,
  };
}));

for (const result of measurements) {
  assert.ok(result.title.right + 10 <= result.evolution.left, "species title overlaps the evolution badge");
  assert.ok(result.populationLabel.right + 10 <= result.populationValue.left, "population label overlaps its value");
  assert.equal(result.statCells.length, 3);
  for (let index = 1; index < result.statCells.length; index += 1) {
    assert.ok(result.statCells[index - 1].right < result.statCells[index].left, "stat cells overlap");
  }
}
assert.ok(Math.abs(measurements[0].card.height - measurements[1].card.height) < 1, "pending and accepted cards have different heights");
assert.deepEqual(errors, []);

await page.screenshot({path: "artifacts/evolving-species-card-alignment.png", fullPage: true});
console.log(JSON.stringify({measurements, errors}, null, 2));
await browser.close();
