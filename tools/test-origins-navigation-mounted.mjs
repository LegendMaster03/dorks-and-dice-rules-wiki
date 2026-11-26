// Mounted app acceptance using actual Origin HTTP captures and native rule sources.
// Non-Origin foreign records use the existing multi-system test fixtures.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { originRoute } from "../src/RulesWiki.Web/wwwroot/origins-navigation.js";
import { createOriginsFixtureBoundary } from "./origins-navigation-fixture-boundary.mjs";
const { manifest, allowed, calls, handle } = createOriginsFixtureBoundary();
const base = "/tools/rules-wiki";
const dom = new JSDOM('<main id="tool-root" data-tool-context-url="/context"></main>', { url: "https://site.test" + base, pretendToBeVisual: true });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "NodeFilter", "Event", "KeyboardEvent"]) globalThis[key] = dom.window[key];
window.dorksAndDiceToolHost = { setContentLayout() {} };
const root = document.getElementById("tool-root");
const originalFetch = globalThis.fetch;
globalThis.fetch = handle;
const wait = async (predicate, label) => {
    for (let i = 0; i < 250; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail(label + ": " + root.textContent.slice(0, 800));
};
const menu = label => [...root.querySelectorAll(".wiki-ribbon-menu")].find(m => m.querySelector("summary")?.textContent === label);
const ribbonButton = label => [...root.querySelectorAll(".wiki-ribbon button")].find(b => b.textContent.trim() === label);
const heading = title => root.querySelector(".wiki-origins h1")?.textContent === title;
const selector = () => root.querySelector(".wiki-ruleset-selector");
const navigate = href => { window.history.pushState({}, "", href); window.dispatchEvent(new Event("popstate")); };
const open = async (label, title = label) => {
    const button = ribbonButton(label);
    assert.ok(button, label);
    button.click();
    await wait(() => heading(title), title);
};
try {
    await import("../src/RulesWiki.Web/wwwroot/app.js");
    await wait(() => root.querySelector(".wiki-home") && menu("Origins"), "first-party home");
    const groups = [...root.querySelectorAll(".wiki-ribbon-menu > summary")].map(e => e.textContent);
    assert.equal(groups[groups.indexOf("Characters") + 1], "Origins");
    assert.equal(ribbonButton("Species"), undefined);
    assert.equal(ribbonButton("Subspecies"), undefined);
    assert.equal(ribbonButton("Ancestry"), undefined);
    assert.equal(menu("Origins").querySelectorAll("button").length, 9);

    // Native details use the same record resolver, with a return link even when
    // opened from a canonical URL or a recent-history item.
    let start = calls.length;
    await open("Character Origins Overview");
    assert.deepEqual(calls.slice(start).map(c => c[0]), ["getNativeRule", "getNativeRule"]);
    await open("Species and Ancestries");
    const red = root.querySelector('a[href*="/rules/ancestry.dragonborn.red"]');
    assert.ok(red);
    assert.ok(root.querySelector(".origin-biological-index"));
    assert.ok(root.querySelector(".wiki-pane-divider"));
    start = calls.length;
    red.dispatchEvent(new window.MouseEvent("click",{bubbles:true,cancelable:true,button:0}));
    await wait(() => root.querySelector(".origin-biological-detail"), "composed biological selection");
    assert.match(window.location.search,/originRecord=ancestry.dragonborn.red/);
    assert.equal(calls.slice(start).filter(c=>c[0]==="getNativeOriginSource").length,1);
    assert.ok(root.querySelector('a[href*="originSelected=ancestry.dragonborn.red"]'));
    const workspaceUrl = base + originRoute("species-and-ancestries");
    navigate(workspaceUrl);
    await wait(() => heading("Species and Ancestries") && !root.querySelector(".origin-biological-detail"), "unselected workspace");
    navigate(red.getAttribute("href"));
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "canonical ancestry detail");
    assert.match(root.querySelector(".rules-core-library-detail .wiki-context-back").getAttribute("href"), /origins\/species-and-ancestries$/);
    assert.ok(root.querySelector(".origin-biological-detail"));
    window.history.back();
    await wait(() => heading("Species and Ancestries"), "history back to workspace");
    window.history.forward();
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "history forward to detail");
    ribbonButton("Wiki home").click();
    await wait(() => root.querySelector('.wiki-recent a[href$="/rules/ancestry.dragonborn.red"]'), "qualified recent history");
    navigate(root.querySelector('.wiki-recent a[href$="/rules/ancestry.dragonborn.red"]').getAttribute("href"));
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "recent detail return");

    // Global search preserves the canonical detail return link.
    ribbonButton("Search all rules").click();
    await wait(() => root.querySelector("input[type=search]"), "global search");
    const search = root.querySelector("input[type=search]");
    search.value = "ancestry.dragonborn.red";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(() => root.querySelector('[data-concept-key="ancestry.dragonborn.red"]'), "exact native search result");
    root.querySelector('[data-concept-key="ancestry.dragonborn.red"]').click();
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "search detail return");
    assert.match(root.querySelector(".rules-core-library-detail .wiki-context-back").getAttribute("href"), /origins\/species-and-ancestries$/);

    // Legacy category access and confirmed missing historical record identity.
    navigate(base + "/subspecies");
    await wait(() => root.querySelector(".rules-core-library-row"), "legacy ancestry category");
    assert.ok(calls.some(c => c[0] === "searchNativeRules" && c[2]?.category === "ancestry"));
    navigate(base + "/subspecies/missing-historical-record");
    await wait(() => root.textContent.includes("No replacement has been assumed."), "legacy missing identity explanation");

    // Mobile disclosure state and keyboard dismissal are mounted behavior.
    Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });
    window.dispatchEvent(new Event("resize"));
    const compact = root.querySelector(".wiki-mobile-menu");
    assert.equal(compact.open, false);
    compact.open = true;
    const origins = menu("Origins");
    origins.open = true;
    const item = origins.querySelector("button");
    item.focus();
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(origins.open, false);
    assert.equal(document.activeElement, origins.querySelector("summary"));
    origins.querySelector("summary").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(compact.open, false);

    for (const [id, label] of [["dnd-5e","Races"], ["dnd-5-5e","Species"], ["fate-condensed","Action"]]) {
        start = calls.length;
        selector().value = id;
        selector().dispatchEvent(new Event("change", { bubbles: true }));
        await wait(() => selector()?.value === id && root.querySelector(".wiki-home") && ribbonButton(label), "foreign " + id);
        assert.equal(menu("Origins"), undefined);
        assert.ok(calls.slice(start).every(c => !c[0].startsWith("getNativeOrigin")));
    }
    start = calls.length;
    navigate(base + "/rulesets/dnd-5e/origins/overview");
    await wait(() => root.textContent.includes("Ruleset unavailable"), "foreign Origins route rejected");
    assert.ok(calls.slice(start).every(c => c[0] === "getNativeRulesets"));
    allowed.delete(manifest.rulesetId);
    start = calls.length;
    navigate(base + originRoute("overview"));
    await wait(() => calls.length > start && root.textContent.includes("Ruleset unavailable"), "denied first-party Origins route");
    assert.ok(calls.slice(start).every(c => c[0] === "getNativeRulesets"));
    console.log("Mounted Origins ribbon, history, canonical details, legacy links, mobile keyboard and foreign catalog tests passed.");
} finally { globalThis.fetch = originalFetch; dom.window.close(); }
