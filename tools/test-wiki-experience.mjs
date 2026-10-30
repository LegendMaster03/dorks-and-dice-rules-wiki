import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { installWikiExperience, installPaneDivider } from "../src/RulesWiki.Web/wwwroot/wiki-experience.js";
import { scrollNativeClassTarget } from "../src/RulesWiki.Web/wwwroot/native-class-navigation.js";
import { classReturnLink } from "../src/RulesWiki.Web/wwwroot/native-class-view-state.js";

const dom = new JSDOM('<main id="tool-root"></main>', { url: "https://site.test/tools/rules-wiki/", pretendToBeVisual: true });
for (const name of ["window", "document", "Node", "Element", "HTMLElement", "Event", "KeyboardEvent"]) globalThis[name] = dom.window[name];
const reader = { scrollTop: 200, getBoundingClientRect: () => ({ top: 100 }) };
let outerScroll = false;
scrollNativeClassTarget({ closest: () => reader, getBoundingClientRect: () => ({ top: 500 }),
    scrollIntoView: () => { outerScroll = true; } });
assert.equal(reader.scrollTop, 480);
assert.equal(outerScroll, false, "Class section navigation scrolls only the reader");
const fingerprint = "a".repeat(64);
let published = fingerprint;
const searches = [];
const root = document.getElementById("tool-root");
const records = [
    { nativeId: "class.warlock", displayName: "Warlock", entityType: "class" },
    { nativeId: "condition.blinded", displayName: "Blinded", entityType: "condition" }
];
const app = {
    root, hostContext: { toolBasePath: "/tools/rules-wiki" }, browserFilters: { entityType: "", query: "" },
    api: {
        getGlobalRulesCatalog: async (filters = {}) => {
            searches.push(filters.query);
            return { rules: filters.query === "owner" ? [records[0]] : records,
                entityTypeFacets: [{ entityType: "class" }, { entityType: "condition" }], fingerprint };
        },
        getNativeRulesets: async () => ({ rulesets: [{ id: "first-party-001", fingerprint: published }] }),
        getNativeRule: async () => ({ rule: { definition: { alphaVersion: "0.3.1" } } })
    },
    navigateRuleFamily: async type => { app.lastType = type; },
    renderActiveView: async container => { container.textContent = "Existing reader"; },
    render: async () => { root.replaceChildren(app.renderNavigation()); const body = document.createElement("div"); root.append(body); await app.renderActiveView(body); }
};
installWikiExperience(app);
await app.prepareWikiExperience();
await app.render();
assert.ok(root.querySelector(".wiki-home"));
assert.equal(root.textContent.includes("Content updates"), false);
const ownerSearch = await app.api.getGlobalRulesCatalog({ query: "owner" });
assert.equal(ownerSearch.rules[0].nativeId, "class.warlock", "Keep native search matches beyond display names");
await app.api.getGlobalRulesCatalog({ query: "owner", offset: 1 });
assert.equal(searches.filter(query => query === "owner").length, 1, "Paging reuses the same search snapshot");
assert.equal(root.querySelector(".rules-core-library-workspace"), null);
assert.match(root.textContent, /Warlock · Alpha 0.3.1/);
assert.equal([...root.querySelectorAll("summary")].some(e => e.textContent === "Magic"), false);
const input = root.querySelector('.wiki-home-search input');
input.value = "Blinded";
root.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
await new Promise(resolve => setImmediate(resolve));
assert.equal(window.location.pathname, "/tools/rules-wiki/all");
assert.equal(new URLSearchParams(window.location.search).get("q"), "Blinded");
assert.match(root.textContent, /Existing reader/);

const workspace = document.createElement("div");
workspace.innerHTML = '<section></section><section class="rules-core-library-detail"></section>';
workspace.getBoundingClientRect = () => ({ width: 1200, left: 0 });
root.append(workspace);
installPaneDivider(workspace);
const divider = workspace.querySelector('[role="separator"]');
divider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
assert.equal(divider.getAttribute("aria-valuenow"), "34");
divider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
assert.equal(divider.getAttribute("aria-valuenow"), "55");
divider.dispatchEvent(new Event("dblclick"));
assert.equal(divider.getAttribute("aria-valuenow"), "32");
let captured;
divider.setPointerCapture = id => { captured = id; };
const pointer = (type, clientX) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId: 4, clientX }); divider.dispatchEvent(event);
};
pointer("pointerdown", 384); pointer("pointermove", 480); pointer("pointerup", 480);
assert.equal(captured, 4);
assert.equal(divider.getAttribute("aria-valuenow"), "40");
assert.equal(JSON.parse(window.localStorage.getItem("rulesWikiPaneRatio")), .4);
const second = workspace.cloneNode(true); second.querySelector(".wiki-pane-divider").remove(); root.append(second);
second.getBoundingClientRect = workspace.getBoundingClientRect;
installPaneDivider(second);
assert.equal(second.querySelector('[role="separator"]').getAttribute("aria-valuenow"), "40");

window.sessionStorage.setItem("rulesWikiClassReturn", JSON.stringify({ version: 1, classId: "class.warlock", className: "Warlock", fingerprint,
    route: "/tools/rules-wiki/rules/class.warlock?q=Warlock", fragment: "#native-class-features-level-9" }));
assert.deepEqual(classReturnLink("class.warlock", fingerprint), { href: "/tools/rules-wiki/rules/class.warlock?q=Warlock#native-class-features-level-9", label: "Back to Warlock" });
assert.equal(classReturnLink("class.warlock", "b".repeat(64)), null);
window.sessionStorage.setItem("rulesWikiClassReturn", JSON.stringify({ version: 1, classId: "class.warlock", fingerprint, route: "https://evil.test/rules/class.warlock" }));
assert.equal(classReturnLink("class.warlock", fingerprint), null);

published = "b".repeat(64);
window.dispatchEvent(new Event("focus"));
await new Promise(resolve => setImmediate(resolve));
assert.match(root.querySelector(".wiki-update-notice").textContent, /Updated rules are available/);
assert.match(root.textContent, /Existing reader/, "New content must not replace an open reader");
[...root.querySelectorAll("button")].find(e => e.textContent === "Dismiss").click();
window.dispatchEvent(new Event("focus"));
await new Promise(resolve => setImmediate(resolve));
assert.equal(root.querySelector(".wiki-update-notice"), null);

Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
window.dispatchEvent(new Event("resize"));
assert.equal(root.querySelector(".wiki-mobile-menu").open, false);
Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
window.dispatchEvent(new Event("resize"));
assert.equal(root.querySelector(".wiki-mobile-menu").open, true);
console.log("Wiki home, supported navigation, search, pointer/keyboard divider persistence, safe class return, update notice, and compact navigation passed.");
dom.window.close();
