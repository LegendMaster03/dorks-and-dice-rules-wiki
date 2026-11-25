// Mounted app acceptance using actual Origin HTTP captures and native rule sources.
// Non-Origin foreign records use the existing multi-system test fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import { originRoute } from "../src/RulesWiki.Web/wwwroot/origins-navigation.js";
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const manifest = read("./fixtures/origin-reference/manifest.json");
const captures = Object.assign({}, ...["responses.json.gz", "hierarchies.json.gz", "construct-characteristic-hierarchies.json.gz"].map(name =>
    JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/origin-reference/" + name, import.meta.url))).toString("utf8"))));
const first = new Map();
for (const response of Object.values(captures)) {
    for (const row of response.rows ?? []) first.set(row.id, { id: row.id, name: row.name, kind: row.kind });
}
for (const response of Object.values(captures)) {
    for (const row of response.lineage ?? []) first.set(row.id, { id: row.id, name: row.name, kind: row.kind, definition: row.definition });
}
for (const name of ["creature-origination", "species-subspecies-upbringing"]) {
    const definition = read("./fixtures/origin-navigation/" + name + ".json");
    first.set(definition.id, { id: definition.id, name: definition.name, kind: definition.kind, definition });
}
// Synthetic catalog facet for the Characters ribbon ordering only; never a
// native rule or an assertion about the captured Core catalog.
first.set("class.synthetic-navigation-test", { id: "class.synthetic-navigation-test", name: "Synthetic navigation test", kind: "class" });
const catalogs = new Map([[manifest.rulesetId, [...first.values()]]]);
for (const fixture of read("./fixtures/multi-system/manifest.json").fixtures) {
    if (fixture.rulesetId === manifest.rulesetId) continue;
    const definition = read("./fixtures/multi-system/" + fixture.file);
    const rows = catalogs.get(fixture.rulesetId) ?? [];
    rows.push({ id: fixture.nativeEntityId, name: definition.name, kind: definition.kind, definition });
    catalogs.set(fixture.rulesetId, rows);
}
const race = read("./fixtures/browser/dnd-5e--race.human.json");
catalogs.get("dnd-5e").push({ id: race.id, name: race.name, kind: race.kind, definition: race });
const fingerprints = new Map([...catalogs.keys()].map((id, i) => [id, id === manifest.rulesetId ? manifest.fingerprint : String(i+1).repeat(64)]));
const allowed = new Set(catalogs.keys());
const base = "/tools/rules-wiki";
const dom = new JSDOM('<main id="tool-root" data-tool-context-url="/context"></main>', { url: "https://site.test" + base, pretendToBeVisual: true });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "NodeFilter", "Event", "KeyboardEvent"]) globalThis[key] = dom.window[key];
window.dorksAndDiceToolHost = { setContentLayout() {} };
const root = document.getElementById("tool-root");
const calls = [];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {"Content-Type": "application/json"} });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
    if (url === "/context") return reply({ apiBaseUrl: "/host/api", toolBasePath: base, toolRoute: "/", siteMode: "dorks-and-dice" });
    if (url === "/host/api/session") return reply({ user: { displayName: "Tester" }, globalRoles: ["Owner"] });
    const op = String(url).split("/").at(-1);
    const args = JSON.parse(options.body).arguments;
    calls.push([op, ...args]);
    if (op === "getNativeRulesets") return reply({ rulesets: [...allowed].map(id => ({
        id, fingerprint: fingerprints.get(id), entityCount: catalogs.get(id).length,
        capabilities: { read: true, write: false, ...(id === manifest.rulesetId ? { originReferenceContractVersion: 1 } : {}) }
    })) });
    const [id, parameter, target] = args;
    if (!allowed.has(id)) return reply({ error: "denied" }, 403);
    const rows = catalogs.get(id);
    const fingerprint = fingerprints.get(id);
    if (op === "getNativeOriginHierarchy" || op === "getNativeOriginMethods") {
        assert.equal(id, manifest.rulesetId);
        assert.equal(parameter, manifest.fingerprint);
        const key = (op === "getNativeOriginHierarchy" ? "hierarchy-" : "methods-") + target + ".json";
        assert.ok(captures[key], key);
        return reply(captures[key]);
    }
    if (op === "getNativeRule") {
        const rule = rows.find(row => row.id === parameter && row.definition);
        return rule ? reply({ rulesetId: id, fingerprint, rule }) : reply({ error: "not found" }, 404);
    }
    assert.equal(op, "searchNativeRules");
    const filters = parameter;
    assert.ok(filters.limit <= 100);
    const matched = rows.filter(r => (!filters.category || r.kind === filters.category) &&
        (!filters.q || (r.id + " " + r.name).toLowerCase().includes(filters.q.toLowerCase())));
    matched.sort((a,b) => a.id.localeCompare(b.id));
    return reply({ rulesetId: id, fingerprint, total: matched.length, offset: filters.offset, limit: filters.limit,
        categoryFacets: [...new Set(rows.map(r => r.kind))].map(kind => ({ kind, count: rows.filter(r => r.kind === kind).length })),
        rules: matched.slice(filters.offset, filters.offset + filters.limit).map(({id,name,kind}) => ({id,name,kind})) });
};
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
    navigate(red.getAttribute("href"));
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "canonical ancestry detail");
    assert.match(root.querySelector(".rules-core-library-detail .wiki-context-back").getAttribute("href"), /origins\/species-and-ancestries$/);
    window.history.back();
    await wait(() => heading("Species and Ancestries"), "history back to workspace");
    window.history.forward();
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "history forward to detail");
    ribbonButton("Wiki home").click();
    await wait(() => root.querySelector('.wiki-recent a[href$="/rules/ancestry.dragonborn.red"]'), "qualified recent history");
    navigate(root.querySelector('.wiki-recent a[href$="/rules/ancestry.dragonborn.red"]').getAttribute("href"));
    await wait(() => root.querySelector(".rules-core-library-detail .wiki-context-back"), "recent detail return");

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
    await wait(() => root.textContent.includes("Ruleset unavailable"), "denied first-party Origins route");
    assert.ok(calls.slice(start).every(c => c[0] === "getNativeRulesets"));
    console.log("Mounted Origins ribbon, history, canonical details, legacy links, mobile keyboard and foreign catalog tests passed.");
} finally { globalThis.fetch = originalFetch; dom.window.close(); }
