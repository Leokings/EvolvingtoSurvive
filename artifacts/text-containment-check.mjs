import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const baseUrl = process.env.EVOLVING_URL || "http://127.0.0.1:4173";
const collectOnly = process.env.AUDIT_ALLOW_ISSUES === "1";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch({executablePath: edgePath, headless: true});

const viewports = {
  phone320: {width: 320, height: 760},
  phone390: {width: 390, height: 844},
  tablet768: {width: 768, height: 1024},
  boundary860: {width: 860, height: 800},
  boundary861: {width: 861, height: 800},
  short913: {width: 913, height: 390},
  boundary1180: {width: 1180, height: 800},
  boundary1181: {width: 1181, height: 800},
  desktop1440: {width: 1440, height: 1000},
};

const scenarios = [
  ...Object.entries(viewports).flatMap(([viewportName, viewport]) => [
    {name: `lobby/${viewportName}`, path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport},
    {name: `setup/${viewportName}`, path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport, action: "setup"},
  ]),
  ...["plan", "sealed", "locked", "reveal", "expired"].flatMap((phase) => Object.entries(viewports).map(([viewportName, viewport]) => ({
    name: `${phase}/${viewportName}`,
    path: `/?demo=1&phase=${phase}&mode=guided`,
    ready: ".game-cockpit",
    viewport,
  }))),
  ...Object.entries(viewports).map(([viewportName, viewport]) => ({
    name: `advanced-plan/${viewportName}`,
    path: "/?demo=1&phase=plan&mode=advanced",
    ready: ".game-cockpit",
    viewport,
  })),
  {name: "reveal/recovery", path: "/?demo=1&phase=reveal&mode=guided", ready: ".game-cockpit", viewport: viewports.desktop1440, action: "recovery"},
  {name: "plan/concede", path: "/?demo=1&phase=plan&mode=advanced", ready: ".game-cockpit", viewport: viewports.desktop1440, action: "concede"},
  {name: "plan/era-recap-desktop", path: "/?demo=1&phase=plan&mode=guided&recap=1", ready: ".era-recap", viewport: viewports.desktop1440},
  {name: "plan/era-recap-phone", path: "/?demo=1&phase=plan&mode=guided&recap=1", ready: ".era-recap", viewport: viewports.phone320},
  ...[viewports.phone320, viewports.tablet768, viewports.desktop1440].flatMap((viewport, index) => {
    const viewportName = ["phone320", "tablet768", "desktop1440"][index];
    return [
      {name: `campaign-home/${viewportName}`, path: "/?demo=1&phase=plan&view=home", ready: ".campaign-home", viewport},
      {name: `how-to-play/${viewportName}`, path: "/how-to-play?demo=1&phase=plan", ready: ".how-to-play", viewport},
    ];
  }),
  {name: "end-run/phone320", path: "/?demo=1&phase=plan&mode=guided", ready: ".game-cockpit", viewport: viewports.phone320, action: "end-run"},
  {name: "end-run/desktop1440", path: "/?demo=1&phase=plan&mode=guided", ready: ".game-cockpit", viewport: viewports.desktop1440, action: "end-run"},
  ...[viewports.phone320, viewports.tablet768, viewports.desktop1440].flatMap((viewport, index) => [
    {name: `waiting/${["phone320", "tablet768", "desktop1440"][index]}`, path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport, action: "waiting-fixture"},
    {name: `world-card/${["phone320", "tablet768", "desktop1440"][index]}`, path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport, action: "world-fixture"},
    {name: `join/${["phone320", "tablet768", "desktop1440"][index]}`, path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport, action: "join-fixture"},
  ]),
  {name: "toast/phone320", path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport: viewports.phone320, action: "toast-fixture"},
  {name: "result/phone320", path: "/?demo=1&view=lobby", ready: ".command-lobby", viewport: viewports.phone320, action: "result-fixture"},
];

function attachDiagnostics(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`response: ${response.status()} ${response.url()}`);
  });
  return errors;
}

async function prepareScenario(page, scenario) {
  let navigationError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`${baseUrl}${scenario.path}`, {waitUntil: "domcontentloaded", timeout: 30_000});
      navigationError = undefined;
      break;
    } catch (error) {
      navigationError = error;
      await page.waitForTimeout(250 * (attempt + 1));
    }
  }
  if (navigationError) throw navigationError;
  await page.locator(scenario.ready).waitFor({state: "visible", timeout: 30_000});
  await page.evaluate(() => document.fonts.ready);
  if (scenario.action === "setup") {
    await page.locator(".launch-campaign").click();
    await page.getByRole("dialog", {name: /Configure a hostile biosphere/i}).waitFor({state: "visible"});
  }
  if (scenario.action === "recovery") {
    await page.getByRole("button", {name: /Restore key for action/i}).click();
    await page.locator(".recovery-console").waitFor({state: "visible"});
  }
  if (scenario.action === "concede") {
    await page.getByRole("button", {name: /Retire selected species/i}).click();
    await page.locator(".concede-zone [role=alert]").waitFor({state: "visible"});
  }
  if (scenario.action === "end-run") {
    await page.getByRole("button", {name: /End my run/i}).click();
    await page.locator(".end-run-dialog").waitFor({state: "visible"});
  }
  if (scenario.action?.endsWith("-fixture")) {
    await installFixture(page, scenario.action);
  }
}

async function installFixture(page, fixture) {
  if (fixture === "waiting-fixture") {
    await page.locator("#root").evaluate((root) => {
      const speciesDetails = (name, status, description) => `
        <div class="species-details">
          <div class="species-heading"><div><small>Your species</small><h2>${name}</h2></div><span>12 evolutions</span></div>
          <p>${description}</p>
          <div class="population-line"><span><small>Population</small><strong>12m</strong></span><i><b style="width:100%"></b></i></div>
          <div class="species-stat-row"><span><small>Best trait</small><strong>Respiration 12</strong></span><span><small>Genes</small><strong>18</strong></span><span><small>Legacy</small><strong>99</strong></span></div>
          <small class="portrait-state ${status}">Portrait: ${status}</small>
        </div>`;
      root.innerHTML = `<div class="app-frame">
        <header class="site-header"><a class="site-brand" href="#"><span><strong>Evolving</strong>toSurvive</span></a><div class="header-actions"><span class="network-pill"><i></i> Studionet</span><span class="demo-pill">Preview</span><button class="wallet-button connected"><span>0x7e57…0001</span><small>Disconnect</small></button></div></header>
        <main class="waiting-shell" id="top">
          <section class="waiting-hero"><span class="large-orb ember_wastes" aria-hidden="true"><i></i><b></b></span><small>Ember Wastes · ets2-studionet-2048</small><h1>The Furnace Beyond the Last Moon</h1><p>Each wallet must establish its founder portrait before simultaneous natural selection begins.</p><div class="waiting-count"><strong>3</strong><span>/ 4 ecosystems</span></div><div class="founder-readiness"><i>◌</i><span><strong>Founder portraits still needed</strong><small>GenLayer validators inspect the exact generated pixels.</small></span></div><div class="waiting-actions"><button class="primary-action">Waiting for portraits<i>→</i></button><button class="text-button">Cancel planet</button></div></section>
          <section class="founder-grid">
            <div class="founder-slot"><article class="species-panel your-species"><div class="species-portrait"><div class="creature-silhouette serpentine" aria-hidden="true"></div><span>Founder lineage</span></div>${speciesDetails("Subterranean Glasswing Serpent", "pending", "A colossal limbless founder with translucent thermal scales, articulated throat vents, and a heat-sensing crown adapted to the deepest ash tunnels.")}</article><button class="secondary-action wide">Generate founder portrait</button></div>
            <div class="founder-slot"><article class="species-panel"><div class="species-portrait"><div class="creature-silhouette amphibious" aria-hidden="true"></div><span>Founder lineage</span></div>${speciesDetails("Tideglass Cartographer Colony", "accepted", "A shoreline crawler whose broad feet, mirrored eyes, and rhythmic throat sacs map pressure changes across hostile tidal plains.")}</article><small class="waiting-on-portrait">Waiting for this wallet's founder portrait</small></div>
            <article class="empty-species-slot"><span>+</span><strong>Open ecosystem slot</strong><small>Share planet ID ets2-studionet-2048</small></article>
          </section>
        </main>
        <footer class="site-footer"><div><strong>EvolvingtoSurvive v2</strong><span>Simultaneous natural selection, settled by intelligent consensus.</span></div><div class="profile-strip"><span><small>Planets</small><strong>12</strong></span><span><small>Wins</small><strong>9</strong></span><span><small>Evolutions</small><strong>99</strong></span><span><small>Best legacy</small><strong>999</strong></span></div><button>Refresh chain state</button></footer>
      </div>`;
    });
    await page.locator(".waiting-shell").waitFor({state: "visible"});
    return;
  }

  if (fixture === "world-fixture") {
    await page.locator(".sector-radar").evaluate((radar) => {
      radar.className = "sector-radar has-worlds";
      radar.innerHTML = `<div class="radar-grid" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div><div class="world-node-grid"><article class="world-signal-card"><span class="scanned-world ember_wastes" aria-hidden="true"><i></i></span><div class="world-signal-copy"><small>Ember Wastes · ID ets2-studionet-2048</small><h2>The Furnace Beyond the Last Moon</h2><p>3 of 4 ecosystems linked</p></div><div class="world-signal-rules"><span><small>Campaign</small><strong>8 eras</strong></span><span><small>Window</small><strong>24 hours</strong></span><span><small>Founders</small><strong>Verification pending</strong></span></div><div class="ecosystem-slots"><i class="filled"></i><i class="filled"></i><i class="filled"></i><i></i></div><button>Deploy founder <span>→</span></button></article></div>`;
    });
    await page.locator(".world-signal-card").waitFor({state: "visible"});
    return;
  }

  if (fixture === "join-fixture") {
    await page.locator(".command-lobby").evaluate((lobby) => {
      lobby.insertAdjacentHTML("beforeend", `<div class="modal-backdrop command-overlay"><form class="game-modal setup-console join-console" role="dialog"><header class="setup-console-header"><span><small>Founder deployment · ets2-studionet-2048</small><strong>Enter The Furnace Beyond the Last Moon</strong></span><b>Ember Wastes</b><button class="modal-close">×</button></header><div class="setup-console-body"><aside class="setup-step-rail"><span class="active"><i>01</i><b>Founder</b><small>Ancestry root</small></span><span><i>02</i><b>Deploy</b><small>Join world</small></span></aside><div class="setup-form-scroll"><section class="setup-section join-lineage-setup"><header><span>01</span><div><strong>Choose your ancestral root</strong><small>You can fork or merge descendants after the campaign begins.</small></div></header><label>Species designation<input value="Subterranean Glasswing Serpent"></label><fieldset class="body-plan-picker"><legend><span>Founding anatomy</span><small>Choose the branch your lineage starts from.</small></legend><div class="body-plan-root"><i></i> Common ancestor</div><div class="body-plan-branches"><label><b class="body-plan-glyph bilateral">Y</b><span><strong>Bilateral</strong><small>Upright symmetry and grasping limbs.</small></span><i>✓</i></label><label><b class="body-plan-glyph quadruped">M</b><span><strong>Quadruped</strong><small>Four-limbed stability and speed.</small></span><i>✓</i></label><label class="selected"><b class="body-plan-glyph serpentine">S</b><span><strong>Serpentine</strong><small>Limbless flexibility and constriction.</small></span><i>✓</i></label><label><b class="body-plan-glyph radial">✣</b><span><strong>Radial</strong><small>A central body with repeating limbs.</small></span><i>✓</i></label><label><b class="body-plan-glyph amphibious">≋</b><span><strong>Amphibious</strong><small>Built to cross water and land.</small></span><i>✓</i></label></div></fieldset><label>Founder phenotype<textarea>A colossal limbless founder with translucent thermal scales, articulated throat vents, and a heat-sensing crown adapted to the deepest ash tunnels.</textarea></label></section></div></div><footer class="setup-submit-bar"><span><i></i> Founder portrait verification follows deployment.</span><button class="primary-action">Deploy founder<i>→</i></button></footer></form></div>`);
    });
    await page.locator(".join-console").waitFor({state: "visible"});
    return;
  }

  if (fixture === "toast-fixture") {
    await page.locator(".command-lobby").evaluate((lobby) => lobby.insertAdjacentHTML("beforeend", `<div class="toast error" role="alert"><span>!</span><p>Every DNA parent needs a canonical portrait before this image can be generated. Restore the exact reveal backup and try again.<small>verify-portrait · 0x1234567890…abcdef</small></p><button>×</button></div>`));
    await page.locator(".toast").waitFor({state: "visible"});
    return;
  }

  await page.locator(".command-lobby").evaluate((lobby) => lobby.insertAdjacentHTML("beforeend", `<section class="result-drawer"><small>Planet complete</small><h2>Your ecosystem survived natural selection.</h2><p>The Furnace Beyond the Last Moon resolved after every ecosystem revealed its sealed DNA.</p><button class="primary-action">Seed another planet <i>→</i></button></section>`));
  await page.locator(".result-drawer").waitFor({state: "visible"});
}

async function auditPage(page) {
  return page.evaluate(() => {
    const tolerance = 1.5;
    const issues = [];
    const root = document.querySelector(".setup-console, .game-cockpit, .command-lobby, .campaign-home, .how-to-play") || document.body;
    const intentionalHorizontalScroll = [
      ".phylogeny-viewport",
      ".deck-gene-scroll",
      ".merge-gene-banks > section > div",
      ".setup-step-rail",
    ].join(",");
    const intentionalEllipsis = [
      ".lobby-ticker strong",
      ".roster-copy strong",
      ".roster-copy small",
      ".rival-radar button span b",
      ".rival-radar button span small",
      ".phylogeny-label strong",
      ".phylogeny-label small",
    ].join(",");

    const selectorFor = (element) => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${CSS.escape(element.id)}` : "";
      const classes = typeof element.className === "string" && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).map((name) => CSS.escape(name)).join(".")}`
        : "";
      return `${tag}${id}${classes}`;
    };
    const isVisible = (element) => {
      if (element.closest('[aria-hidden="true"],svg,script,style,template')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const outsideHorizontally = (inner, outer) => (
      inner.left < outer.left - tolerance
      || inner.right > outer.right + tolerance
    );
    const outsideControl = (inner, outer) => (
      outsideHorizontally(inner, outer)
      || inner.top < outer.top - tolerance
      || inner.bottom > outer.bottom + tolerance
    );
    const box = (rect) => ({
      left: Math.round(rect.left * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
    });
    const push = (entry) => {
      const key = `${entry.type}|${entry.element}|${entry.text || ""}|${entry.boundary || ""}`;
      if (!issues.some((candidate) => candidate.key === key)) issues.push({...entry, key});
    };

    const all = [root, ...root.querySelectorAll("*")];
    for (const element of all) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      const style = getComputedStyle(element);
      const directNodes = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());

      for (const node of directNodes) {
        const text = node.textContent.trim().replace(/\s+/g, " ");
        const range = document.createRange();
        range.selectNodeContents(node);
        const elementRect = element.getBoundingClientRect();
        const control = element.closest("button,a,label,[role=button],[role=tab]");
        const controlRect = control?.getBoundingClientRect();
        for (const textRect of [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)) {
          if (outsideHorizontally(textRect, elementRect) && !element.matches(intentionalEllipsis)) {
            push({type: "text-outside-element", element: selectorFor(element), text: text.slice(0, 90), textBox: box(textRect), elementBox: box(elementRect)});
          }
          if (control && controlRect && outsideControl(textRect, controlRect) && !element.matches(intentionalEllipsis)) {
            push({type: "text-outside-control", element: selectorFor(element), boundary: selectorFor(control), text: text.slice(0, 90), textBox: box(textRect), boundaryBox: box(controlRect)});
          }
        }
      }

      if (!directNodes.length || element.matches(intentionalEllipsis)) continue;
      const fontSize = Number.parseFloat(style.fontSize);
      if (fontSize < 9) {
        push({
          type: "micro-text",
          element: selectorFor(element),
          text: directNodes.map((node) => node.textContent.trim()).join(" ").slice(0, 90),
          fontSize,
        });
      }
      const horizontalOverflow = element.scrollWidth > element.clientWidth + 2;
      const verticalOverflow = element.scrollHeight > element.clientHeight + 2;
      if (horizontalOverflow && !element.matches(intentionalHorizontalScroll)) {
        push({
          type: "horizontal-text-overflow",
          element: selectorFor(element),
          text: directNodes.map((node) => node.textContent.trim()).join(" ").slice(0, 90),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
        });
      }
      const lineClamped = style.webkitLineClamp && style.webkitLineClamp !== "none";
      if (verticalOverflow && !lineClamped && ["hidden", "clip"].includes(style.overflowY)) {
        push({
          type: "vertical-text-clipping",
          element: selectorFor(element),
          text: directNodes.map((node) => node.textContent.trim()).join(" ").slice(0, 90),
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflowY: style.overflowY,
        });
      }
    }

    const documentOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    if (documentOverflow) {
      issues.push({
        key: "document-horizontal-overflow",
        type: "document-horizontal-overflow",
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      });
    }
    return {issues: issues.map(({key: _key, ...issue}) => issue), documentOverflow};
  });
}

const results = [];
for (const scenario of scenarios) {
  const page = await browser.newPage({viewport: scenario.viewport, deviceScaleFactor: 1});
  const errors = attachDiagnostics(page);
  await prepareScenario(page, scenario);
  const audit = await auditPage(page);
  if (audit.issues.length) {
    const safeName = scenario.name.replaceAll("/", "-");
    await page.screenshot({path: `artifacts/text-containment-${safeName}.png`, fullPage: true});
  }
  results.push({name: scenario.name, viewport: scenario.viewport, ...audit, errors});
  await page.close();
}

await browser.close();
const failed = results.filter((result) => result.issues.length || result.errors.length);
const summary = {
  baseUrl,
  scenarios: results.length,
  clean: results.length - failed.length,
  failed: failed.map((result) => ({name: result.name, viewport: result.viewport, issues: result.issues, errors: result.errors})),
};
console.log(JSON.stringify(summary, null, 2));
if (!collectOnly) assert.equal(failed.length, 0, `${failed.length} text-containment scenario(s) failed`);
