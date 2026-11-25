// Mounted Wiki browser against actual pinned Core records and a simulated private boundary.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const manifest = read("./fixtures/multi-system/manifest.json");
const catalogs = new Map();
for (const entry of manifest.fixtures) {
    const definition = read("./fixtures/multi-system/" + entry.file);
    const records = catalogs.get(entry.rulesetId) ?? [];
    records.push({id: entry.nativeEntityId, name: definition.name, kind: definition.kind, definition});
    catalogs.set(entry.rulesetId, records);
}
const race = read("./fixtures/browser/dnd-5e--race.human.json");
catalogs.get("dnd-5e").push({id: race.id, name: race.name, kind: race.kind, definition: race});
const allowed = new Set(catalogs.keys());
const fingerprints = new Map([...allowed].map((id, i) => [id, String(i+1).repeat(64)]));
const base = "/tools/rules-wiki";
const dom = new JSDOM('<main id="tool-root" data-tool-context-url="/context"></main>', {url: "https://site.test" + base, pretendToBeVisual: true});
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "KeyboardEvent"]) globalThis[key] = dom.window[key];
window.dorksAndDiceToolHost = {setContentLayout() {}};
const calls = [];
let release;
const delayed = new Promise(resolve => { release = resolve; });
const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
globalThis.fetch = async (url, options = {}) => {
    if (url === "/context") return reply({apiBaseUrl: "/host/api", toolBasePath: base, toolRoute: "/", siteMode: "dorks-and-dice"});
    if (url === "/host/api/session") return reply({user: {displayName: "Tester"}, globalRoles: ["Owner"]});
    const op = String(url).split("/").at(-1);
    const args = JSON.parse(options.body).arguments;
    calls.push([op, ...args]);
    if (op === "getNativeRulesets") return reply({rulesets: [...allowed].map(id => ({
        id, fingerprint: fingerprints.get(id), entityCount: catalogs.get(id).length, capabilities: {read: true, write: false}
    }))});
    const [id, filters] = args;
    if (!allowed.has(id)) return reply({error: "denied"}, 403);
    const records = catalogs.get(id);
    const fingerprint = fingerprints.get(id);
    if (op === "getNativeRule") {
        const rule = records.find(r => r.id === filters);
        return rule ? reply({rulesetId: id, fingerprint, rule}) : reply({error: "not found"}, 404);
    }
    assert.equal(op, "searchNativeRules");
    assert.ok(filters.limit <= 100);
    if (id === "fate-condensed" && filters.q === "delayed") await delayed;
    const matching = records.filter(r => (!filters.category || r.kind.toLowerCase() === filters.category.toLowerCase()) &&
        (!filters.q || (r.id + " " + r.name).toLowerCase().includes(filters.q.toLowerCase())));
    matching.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return reply({rulesetId: id, fingerprint, total: matching.length, offset: filters.offset, limit: filters.limit,
        categoryFacets: [...new Set(records.map(r => r.kind))].map(kind => ({kind, count: records.filter(r => r.kind === kind).length})),
        rules: matching.slice(filters.offset, filters.offset + filters.limit).map(({id,name,kind}) => ({id,name,kind}))});
};
const root = document.getElementById("tool-root");
const wait = async (predicate, label) => {
    for (let i = 0; i < 200; i++) {if (predicate()) return; await new Promise(r => setTimeout(r, 10));}
    assert.fail(label + ": " + root.textContent.slice(0, 600));
};
const selector = () => root.querySelector(".wiki-ruleset-selector");
const button = label => [...root.querySelectorAll("button")].find(b => b.textContent.trim() === label);
const home = id => selector()?.value === id && root.querySelector(".wiki-home");
const select = async id => {
    selector().value = id;
    selector().dispatchEvent(new Event("change", {bubbles: true}));
    await wait(() => home(id), "home " + id);
};
const browse = async (label, id, kind) => {
    const before = calls.length;
    assert.ok(button(label), label);
    button(label).click();
    await wait(() => root.querySelector(".rules-core-library-row") && calls.slice(before).some(c => c[0] === "getNativeRule" && c[1] === id), "browse " + id + "/" + kind);
    await wait(() => root.querySelector(".rules-core-library-detail-body"), "detail " + id);
    assert.ok(calls.slice(before).some(c => c[0] === "searchNativeRules" && c[1] === id && c[2].category === kind));
    assert.equal(calls.slice(before).filter(c => c[0] === "getNativeRulesets").length, 0);
};
try {
    await import("../src/RulesWiki.Web/wwwroot/app.js");
    await wait(() => home("first-party-001"), "first-party home");
    assert.equal([...selector().options].filter(o => o.value).length, 4);
    await browse("Bestiary", "first-party-001", "monster");
    // Synthetic rows exercise scale only; not authored gameplay or policy changes.
    const first = catalogs.get("first-party-001");
    for (let i = 0; i < 150; i++) first.push({id: "rule.scale-" + i, name: "Scale " + i, kind: "rule", definition: {}});
    button("Search all rules").click();
    await wait(() => root.querySelectorAll(".rules-core-library-row").length === 100, "paged index");
    let start = calls.length;
    const pendingSearch = root.querySelector("input[type=search]");
    pendingSearch.value = "Scale"; pendingSearch.dispatchEvent(new Event("input", {bubbles: true}));
    root.querySelector(".rules-core-library-index-list").dispatchEvent(new Event("scroll"));
    await wait(() => calls.slice(start).some(c => c[0] === "searchNativeRules" && c[2].q === "Scale"), "new search");
    assert.ok(calls.slice(start).filter(c => c[0] === "searchNativeRules").every(c => c[2].offset === 0),
        "paging cannot continue the preceding result stream during debounce");
    await wait(() => root.querySelectorAll(".rules-core-library-row").length === 100, "new search page");
    start = calls.length;
    await select("dnd-5e");
    assert.equal(calls.length - start, 2, "fresh foreign home: discovery plus bounded facet read");
    assert.ok(button("Races")); assert.equal(button("Species"), undefined);
    await browse("Races", "dnd-5e", "race");
    await browse("Classes", "dnd-5e", "class");
    root.querySelector(".rules-core-library-row").click();
    await wait(() => window.location.pathname === base + "/rulesets/dnd-5e/rules/class.warlock", "qualified Warlock route");
    assert.equal(new URLSearchParams(window.location.search).get("category"), "class");
    start = calls.length;
    window.dispatchEvent(new Event("popstate"));
    await wait(() => root.querySelector(".rules-core-library-detail-body") &&
        calls.slice(start).some(c => c[0] === "searchNativeRules" && c[1] === "dnd-5e"), "restore record category");
    assert.ok(calls.slice(start).some(c => c[0] === "searchNativeRules" && c[2].category === "class"));
    assert.equal(root.querySelectorAll(".rules-core-library-row").length, 1);
    await select("dnd-5-5e");
    assert.ok(button("Species")); assert.equal(button("Races"), undefined);
    await browse("Species", "dnd-5-5e", "species");
    await browse("Classes", "dnd-5-5e", "class");
    assert.ok(calls.some(c => c[0] === "getNativeRule" && c[1] === "dnd-5e" && c[2] === "class.warlock"));
    assert.ok(calls.some(c => c[0] === "getNativeRule" && c[1] === "dnd-5-5e" && c[2] === "class.warlock"));
    await select("fate-condensed");
    assert.ok(button("Action")); assert.ok(button("Chapter")); assert.equal(button("Classes"), undefined);
    await browse("Action", "fate-condensed", "action");
    const search = root.querySelector("input[type=search]");
    search.value = "delayed"; search.dispatchEvent(new Event("input", {bubbles: true}));
    await wait(() => calls.some(c => c[0] === "searchNativeRules" && c[1] === "fate-condensed" && c[2].q === "delayed"), "in-flight search");
    await select("dnd-5e");
    release();
    await new Promise(r => setTimeout(r, 100));
    assert.ok(home("dnd-5e"), "late foreign response must not replace the new home");
    await select("dnd-5-5e");
    window.history.back();
    await wait(() => home("dnd-5e"), "history back to catalog");
    window.history.forward();
    await wait(() => home("dnd-5-5e"), "history forward to catalog");
    allowed.delete("dnd-5e");
    start = calls.length;
    window.history.pushState({}, "", base + "/rulesets/dnd-5e/rules/class.warlock");
    window.dispatchEvent(new Event("popstate"));
    await wait(() => root.textContent.includes("Ruleset unavailable"), "denied deep link");
    assert.ok(![...selector().options].some(o => o.value === "dnd-5e"));
    assert.ok(calls.slice(start).every(c => c[0] === "getNativeRulesets"), "denied route must not issue catalog reads");
    console.log("Four-system mounted Wiki navigation, terminology, qualified IDs, history, stale search, authorization and bounded discovery passed.");
} finally { release(); dom.window.close(); }
