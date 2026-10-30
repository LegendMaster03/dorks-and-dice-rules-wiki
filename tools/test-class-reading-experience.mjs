import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

// Real native content shapes, including the corrected repeated grant schedule.
const fixture = JSON.parse(await readFile(new URL("./fixtures/native-class-reading.json", import.meta.url)));
const records = Object.values(fixture).filter(record => record.id);
records.push(...fixture["features/classes/warlock/features.json"].classFeatures);
const fingerprint = "a".repeat(64);
const dom = new JSDOM('<main id="tool-root" data-tool-context-url="/context"></main>', {
    url: "https://site.test/tools/rules-wiki/rules/class.warlock?q=Warlock", pretendToBeVisual: true
});
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "KeyboardEvent"])
    globalThis[key] = dom.window[key];
window.dorksAndDiceToolHost = { setContentLayout() {} };
const reads = [];
globalThis.fetch = async (url, options = {}) => {
    let body;
    if (url === "/context") body = { apiBaseUrl: "/host/api", toolBasePath: "/tools/rules-wiki",
        toolRoute: "/rules/class.warlock", siteMode: "dorks-and-dice" };
    else if (url === "/host/api/session") body = { user: { displayName: "Tester" }, globalRoles: ["Owner"] };
    else {
        const op = String(url).split("/").at(-1);
        const args = JSON.parse(options.body).arguments;
        if (op === "getNativeRulesets") body = { rulesets: [{ id: "first-party-001", entityCount: records.length, fingerprint }] };
        else if (op === "searchNativeRules") {
            const filters = args[1];
            const found = records.filter(record => (!filters.category || record.kind === filters.category)
                && (!filters.q || JSON.stringify(record).toLowerCase().includes(filters.q.toLowerCase())));
            body = { rulesetId: args[0], fingerprint, total: found.length,
                rules: found.slice(filters.offset, filters.offset + filters.limit).map(({ id, name, kind }) => ({ id, name, kind })) };
        } else if (op === "getNativeRule") {
            reads.push(args[1]);
            const record = records.find(record => record.id === args[1]);
            assert.ok(record, `Unexpected native lookup: ${args[1]}`);
            body = { rulesetId: args[0], fingerprint, rule: { id: record.id, name: record.name,
                kind: record.kind, definition: record } };
        } else throw new Error(`Unexpected operation: ${op}`);
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
};
const wait = async predicate => {
    for (let i = 0; i < 150; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail("Class reading UI did not settle");
};
await import("../src/RulesWiki.Web/wwwroot/app.js");
await wait(() => document.querySelector(".native-class-option-overview"));
const root = document.querySelector(".native-class-reference");
const systems = [...root.querySelectorAll(".native-class-customization-system")];
const patron = systems.find(system => system.querySelector("summary strong").textContent === "Patron");
assert.equal(patron.querySelectorAll("input, select, .native-class-customization-option-detail").length, 0);
assert.equal(patron.querySelector(".native-class-rule-link").getAttribute("href"), "/tools/rules-wiki/rules/patron.warlock.fiend");
const pact = systems.find(system => system.querySelector("summary strong").textContent === "Pact");
pact.querySelector("summary").click();
await wait(() => pact.querySelectorAll(".native-class-customization-option-detail").length === 4);
assert.equal(pact.querySelectorAll("input, select").length, 0);
const blade = pact.querySelector('[data-option-id="pact.warlock.blade"]');
blade.querySelector("summary").click();
await wait(() => blade.querySelector(".native-class-option-improvement"));
assert.match(blade.querySelector(".native-class-option-improvement").textContent, /Level 5.*Attack twice/s);
assert.equal(blade.querySelector(".native-class-option-improvement").closest(".native-class-technical-details"), null);
assert.equal(blade.querySelector("h5")?.textContent, "Level 5 · Deepened Pact", "Do not repeat the option title in its body");

// Dispatch a genuine bubbling click through the mounted shell, not a callback stub.
let escapedFragments = 0;
document.addEventListener("click", event => {
    if (event.target.closest('a[href^="#native-class-"]')) escapedFragments++;
});
const featureLink = root.querySelector('a[href="#native-class-feature-class-feature.warlock.contact-patron"]');
featureLink.click();
await wait(() => root.querySelector('[id="native-class-feature-class-feature.warlock.contact-patron"] p')?.textContent.includes("Contact Other Plane"));
assert.equal(document.querySelector(".native-class-reference"), root, "Navigation must retain the mounted class");
assert.equal(escapedFragments, 0, "Fragment navigation must not reach the host route handler");
assert.equal(root.querySelector('[aria-label="Focus class level"]').value, "9");
assert.equal(root.querySelector(".native-class-table tr.is-selected").getAttribute("data-class-level"), "9");
assert.equal(pact.open, true);
assert.equal(blade.querySelector("details").open, true);
const asiLink = root.querySelector('a[href="#native-class-feature-class-feature.warlock.ability-score-improvement-level-8"]');
asiLink.click();
assert.equal(root.querySelector('[aria-label="Focus class level"]').value, "8");
window.history.back();
await wait(() => window.location.hash.endsWith("contact-patron")
    && root.querySelector('[aria-label="Focus class level"]').value === "9");
assert.equal(document.querySelector(".native-class-reference"), root, "History must retain the mounted class");
for (const name of ["Invocations", "Cantrips", "Spells known", "Pact slots", "Slot level"]) {
    const header = [...root.querySelectorAll(".native-class-table thead th")].find(header => header.textContent === name);
    assert.ok(header && !header.classList.contains("native-class-extra-column"), `${name} must be visible by default`);
}
assert.deepEqual([...root.querySelectorAll(".native-class-table tbody tr")]
    .filter(row => row.textContent.includes("Ability Score Improvement")).map(row => Number(row.getAttribute("data-class-level"))), [4, 8, 12, 16, 19]);

// Returning from an independent rule remounts the class in the hosted shell.
// Restore deferred catalogs and their filters, not just the URL fragment.
const invocationSystem = systems.find(system => system.querySelector("summary strong").textContent === "Invocations");
invocationSystem.querySelector("summary").click();
await wait(() => invocationSystem.querySelector("input"));
const invocationSearch = invocationSystem.querySelector("input");
invocationSearch.value = "Devouring";
invocationSearch.dispatchEvent(new Event("input", { bubbles: true }));
const pane = root.closest(".rules-core-library-detail");
pane.scrollTop = 420;
const fullReference = patron.querySelector(".native-class-rule-link");
// Prevent jsdom's external document navigation after the real capture handler.
fullReference.addEventListener("click", event => event.preventDefault());
fullReference.click();
const stored = JSON.parse(window.sessionStorage.getItem("rulesWikiClassReturn"));
assert.ok(stored.details.includes("pact.warlock.blade"));
const { renderNativeClass } = await import("../src/RulesWiki.Web/wwwroot/native-class-detail.js");
const { renderNativeValue } = await import("../src/RulesWiki.Web/wwwroot/native-rule-detail.js");
const rage = JSON.parse(await readFile(new URL("./fixtures/native-rage.json", import.meta.url)));
const mechanicalClass = renderNativeClass({ id: "class.barbarian", name: "Barbarian", kind: "class",
    definition: { progression: [{ level: 1, featureGrants: [rage.id] }] } }, {
    renderValue: renderNativeValue, getRule: async () => ({ rule: { ...rage, definition: rage } })
});
document.body.append(mechanicalClass);
mechanicalClass.querySelector(".native-class-feature > summary").click();
await wait(() => mechanicalClass.querySelector(".native-class-feature-content dl"));
const mechanicsTerm = [...mechanicalClass.querySelectorAll("dt")].find(term => term.textContent === "Mechanics");
assert.ok(mechanicsTerm);
assert.equal(mechanicsTerm.closest(".native-class-technical-details"), null,
    "Actual feature mechanics must not be hidden with source/status metadata");
const returned = renderNativeClass(records.find(record => record.id === "class.warlock"), {
    renderValue: renderNativeValue, catalogFingerprint: fingerprint,
    getRule: async id => {
        const record = records.find(record => record.id === id);
        return { fingerprint, rule: { id, name: record.name, kind: record.kind, definition: record } };
    },
    searchRules: async ({ category }) => {
        const found = records.filter(record => record.kind === category);
        return { fingerprint, total: found.length, rules: found };
    }
});
const returnPane = document.createElement("section");
returnPane.className = "rules-core-library-detail";
returnPane.append(returned);
document.body.append(returnPane);
await wait(() => returned.querySelector('[aria-label="Filter Invocations options by name"]')?.value === "Devouring"
    && returned.querySelector('[data-option-id="pact.warlock.blade"] > details')?.open);
assert.equal(returned.querySelector('[aria-label="Focus class level"]').value, "9");
assert.equal(window.sessionStorage.getItem("rulesWikiClassReturn"), null, "Return state is consumed, not a persistent character configuration");
await wait(() => returnPane.scrollTop === 420);
// Leave again while the deferred Invocation catalog is still loading.
window.sessionStorage.setItem("rulesWikiClassReturn", JSON.stringify(stored));
let finishInvocations;
const delayedInvocationPage = new Promise(resolve => { finishInvocations = resolve; });
const earlyReturn = renderNativeClass(records.find(record => record.id === "class.warlock"), {
    renderValue: renderNativeValue, catalogFingerprint: fingerprint,
    getRule: async id => {
        const record = records.find(record => record.id === id);
        return { fingerprint, rule: { id, name: record.name, kind: record.kind, definition: record } };
    },
    searchRules: async ({ category }) => {
        if (category === "invocation") return delayedInvocationPage;
        const found = records.filter(record => record.kind === category);
        return { fingerprint, total: found.length, rules: found };
    }
});
document.body.append(earlyReturn);
await wait(() => earlyReturn.querySelector(".native-class-option-overview .native-class-rule-link"));
assert.equal(earlyReturn.querySelector('[aria-label="Filter Invocations options by name"]'), null);
const earlyLink = earlyReturn.querySelector(".native-class-option-overview .native-class-rule-link");
earlyLink.addEventListener("click", event => event.preventDefault());
earlyLink.click();
const earlyState = JSON.parse(window.sessionStorage.getItem("rulesWikiClassReturn"));
assert.equal(earlyState.controls["2:Filter Invocations options by name"].value, "Devouring");
assert.ok(earlyState.details.includes("pact.warlock.blade"));
const invocationRecords = records.filter(record => record.kind === "invocation");
finishInvocations({ fingerprint, total: invocationRecords.length, rules: invocationRecords });
await wait(() => earlyReturn.querySelector('[aria-label="Filter Invocations options by name"]')?.value === "Devouring");
// Malformed or stale reading state must never prevent the class from rendering.
window.sessionStorage.setItem("rulesWikiClassReturn", JSON.stringify({ ...stored, systems: {} }));
assert.doesNotThrow(() => renderNativeClass(records.find(record => record.id === "class.warlock"), { renderValue: renderNativeValue }));
window.sessionStorage.removeItem("rulesWikiClassReturn");

// Direct routes use the same presentation as embedded options, including nesting.
const { renderNativeDetail } = await import("../src/RulesWiki.Web/wwwroot/native-rule-detail.js");
for (const record of records.filter(record => ["patron", "pact", "invocation"].includes(record.kind))) {
    const container = document.createElement("div");
    renderNativeDetail(container, { rulesetId: "first-party-001", fingerprint,
        rule: { id: record.id, name: record.name, kind: record.kind, definition: record } }, () => {});
    assert.equal(container.querySelector("h2").textContent, record.name);
    assert.equal(container.querySelectorAll("h2").length, 1);
    assert.ok(container.querySelector(".native-class-option-reference"));
    if (record.kind === "patron") {
        assert.equal(container.querySelectorAll(".native-class-option-feature").length, record.features.length);
        assert.equal(container.querySelectorAll(".native-class-option-spells tbody tr").length, record.spellAccess.grants.length);
    }
    if (record.kind === "pact") assert.equal(container.querySelector(".native-class-option-improvement p").textContent, record.deepenedAtLevel5);
}
console.log("Hosted class reading: compact catalogs, Pact rules, shared direct routes, repeated grants, resource columns, real click propagation and Back history passed.");
dom.window.close();
