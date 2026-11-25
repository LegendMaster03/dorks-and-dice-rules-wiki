/** Isolated F acceptance. Native source files are pinned; only uncaptured
 * HTTP envelopes and missing/denied targets are synthetic transport fixtures. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import { createRulesContext } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader, createPresentationInput, createNativeRendererRegistry, mountNativePresentation } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { registerNativeRenderers } from "../src/RulesWiki.Web/wwwroot/native-renderers-reference.js";
import { registerLifeExperienceRenderers } from "../src/RulesWiki.Web/wwwroot/native-renderers-life-experiences.js";
import { renderPackageAttribution } from "../src/RulesWiki.Web/wwwroot/package-attribution.js";

const dom = new JSDOM("<main></main>", { url: "https://wiki.example.test/" });
for (const key of ["window", "document", "Node", "NodeFilter", "Element", "HTMLElement", "Event"]) globalThis[key] = dom.window[key];
const main = document.querySelector("main");
const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const coreCommit = "0baa466b7fc8f55e5d675b886f76e95f9a4b551f";
const records = new Map();
for (const file of ["upbringings-1", "upbringings-2", "backgrounds-1", "backgrounds-2"]) {
    const pack = read("./fixtures/life-experiences/" + file + ".json");
    assert.equal(pack.coreCommit, coreCommit);
    for (const { path, blobSha, record } of pack.records) {
        assert.match(blobSha, /^[a-f0-9]{40}$/);
        assert.ok(path.startsWith("data/rulesets/first-party-001/native/"));
        assert.ok(!records.has(record.id));
        records.set(record.id, record);
    }
}
const fixture = id => { assert.ok(records.has(id), id); return records.get(id); };
const manifest = read("./fixtures/origin-reference/manifest.json");
const captures = {};
for (const file of ["responses", "hierarchies", "construct-characteristic-hierarchies"])
    Object.assign(captures, JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/origin-reference/" + file + ".json.gz", import.meta.url)))));
const context = createRulesContext({ rulesetId: manifest.rulesetId, fingerprint: manifest.fingerprint });
const descriptor = { id: context.rulesetId, fingerprint: context.fingerprint, capabilities: { read: true, originReferenceContractVersion: 1 } };
const registry = createNativeRendererRegistry();
registerNativeRenderers(registry);
registerLifeExperienceRenderers(registry);
const lease = { isCurrent: () => true };
const envelope = (record, c = context) => ({ rulesetId: c.rulesetId, fingerprint: c.fingerprint,
    rule: { id: record.id, name: record.name, kind: record.kind, definition: structuredClone(record) } });
const actual = name => { assert.ok(captures[name], name); return structuredClone(captures[name]); };
const upbringingRows = actual("hierarchy-upbringing.json").rows;
const backgroundRows = actual("hierarchy-backgrounds.json").rows;
assert.equal(upbringingRows.length, 13);
assert.equal(backgroundRows.length, 16);
for (const row of [...upbringingRows, ...backgroundRows]) {
    const record = fixture(row.id);
    assert.equal(record.selectable, row.selectable);
    assert.equal(record.parent ?? null, row.parentId ?? null);
    assert.equal(record.kind, row.kind);
}
// Only one actual cultural lineage envelope was captured by A. Other cases
// use pinned source records in explicitly synthetic response envelopes.
function sourceResponse(id) {
    const captured = captures["source-" + id + ".json"];
    if (captured) return structuredClone(captured);
    const r = fixture(id);
    const chain = r.parent ? [fixture(r.parent), r] : [r];
    return { contractVersion: 1, rulesetId: context.rulesetId, fingerprint: context.fingerprint, sourceId: id,
        directReference: null, lineage: chain.map(definition => ({ id: definition.id, name: definition.name,
            kind: definition.kind, inheritedSource: definition.id !== id, definition: structuredClone(definition), traitOccurrences: [] })) };
}
// Resolved test references are actual existing Wiki fixtures, not guessed labels.
for (const file of ["first-party-001--skill.athletics", "first-party-001--equipment.group.weapon.all", "first-party-001--competency.smithing"]) {
    const r = read("./fixtures/native-entities/" + file + ".json"); records.set(r.id, r);
}
const previewIndex = process.argv.indexOf("--preview-dir");
const previewDir = previewIndex < 0 ? null : process.argv[previewIndex + 1];
if (previewDir) mkdirSync(previewDir, { recursive: true });
function setup(record, options = {}) {
    const calls = { source: 0, hierarchy: 0, resolve: 0 };
    const api = {
        getNativeOriginSource: async (ruleset, fingerprint, id) => {
            calls.source++; assert.equal(ruleset, context.rulesetId); assert.equal(fingerprint, context.fingerprint);
            if (options.sourceError) throw options.sourceError;
            if (options.onSource) await options.onSource();
            return sourceResponse(id);
        },
        getNativeOriginHierarchy: async (ruleset, fingerprint, family) => {
            calls.hierarchy++; assert.equal(ruleset, context.rulesetId); assert.equal(fingerprint, context.fingerprint);
            assert.equal(family, "biological"); return actual("hierarchy-biological.json");
        },
        getNativeRule: async (ruleset, id) => {
            calls.resolve++; assert.equal(ruleset, context.rulesetId);
            if (options.referenceError) throw options.referenceError;
            if (!records.has(id)) throw Object.assign(Error("Missing target"), { status: 404 });
            return envelope(fixture(id));
        },
        searchNativeRules: async () => { throw Error("Unexpected global search"); }
    };
    const reader = createRulesetReader(api, context, options.old ? null : descriptor);
    const input = createPresentationInput(context, envelope(record), reader, { lifecycle: options.lease ?? lease });
    return { input, calls };
}
async function show(record) {
    const { input, calls } = setup(record);
    const before = JSON.stringify(input.record);
    assert.equal(registry.select(input).id, "origins.life-experiences");
    assert.equal(await mountNativePresentation(main, registry, input, { decorate: article => {
        const wrapper = document.createElement("div");
        wrapper.append(article, renderPackageAttribution(input.context, input.packageDescriptor));
        return wrapper;
    } }), true);
    assert.equal(JSON.stringify(input.record), before);
    assert.equal(main.querySelectorAll(".ruleset-package-attribution").length, 1);
    assert.equal(main.querySelector("button,input,select,textarea,script,[onclick]"), null);
    assert.equal(calls.source, record.kind === "upbringing" ? 1 : 0);
    assert.equal(calls.hierarchy, record.kind === "upbringing" ? 1 : 0);
    assert.ok(calls.resolve <= 64);
    assert.ok(main.textContent.includes(record.name));
    for (const a of main.querySelectorAll("a[href]")) assert.ok(a.getAttribute("href").startsWith("/rulesets/first-party-001/rules/"));
    const ownGrants = [...main.querySelectorAll("[data-source-id]")].filter(n => n.dataset.sourceId === record.id &&
        /^\/benefits\/\d+$/.test(n.dataset.sourcePointer));
    assert.equal(ownGrants.length, record.benefits.length, record.id);
    if (previewDir) writeFileSync(previewDir + "/" + record.id + ".html",
        '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><main>' + main.innerHTML + '</main>');
    return main.cloneNode(true);
}
const views = new Map();
for (const row of [...upbringingRows, ...backgroundRows]) views.set(row.id, await show(fixture(row.id)));
const view = id => views.get(id);
const drow = view("upbringing.elf.drow");
assert.match(drow.textContent, /Select one effective Upbringing/);
assert.match(drow.textContent, /activity must qualify, not merely the location/i);
assert.match(drow.textContent, /Undercommon/);
assert.equal(drow.querySelectorAll('.life-experience-inherited [data-source-id="upbringing.elf.general"][data-source-pointer="/benefits/0"]').length, 1);
assert.equal(drow.querySelectorAll('.life-experience-local [data-source-id="upbringing.elf.drow"][data-source-pointer="/benefits/1"]').length, 1);
assert.ok(drow.querySelector('a[href="/rulesets/first-party-001/rules/upbringing.elf.general"]'));
assert.equal(view("upbringing.elf.general").querySelector(".life-experience-inherited"), null);
assert.match(view("upbringing.gnome.general").textContent, /not independently selectable/);
assert.match(view("upbringing.aristocratic").textContent, /available to any Species/);
assert.match(view("upbringing.elf.wood").textContent, /forest-navigation/);
const entertainer = view("background.entertainer");
assert.match(entertainer.textContent, /Choose 1/);
assert.match(entertainer.textContent, /Ranks granted: 1/);
assert.match(entertainer.textContent, /Proficiency granted: No/);
assert.match(entertainer.textContent, /Conditional item choices/);
assert.ok(entertainer.querySelector('[data-source-pointer="/benefits/2/options/1/equipmentProficiencyGrants/choices/0"]'));
assert.ok(entertainer.querySelector(".life-experience-equipment [data-source-pointer='/startingEquipment/items/0']"));
assert.equal(entertainer.querySelector('a[href$="/equipment.group.tool.musical-instrument"]'), null);
assert.ok(view("background.gladiator").querySelector('a[href="/rulesets/first-party-001/rules/equipment.group.weapon.all"]'));
assert.match(view("background.acolyte").textContent, /Prayer wheel/);
assert.match(view("background.hermit").textContent, /Choose 2 distinct options/);
assert.match(view("background.folk-hero").textContent, /Choose 2 distinct options/);
assert.ok(view("background.soldier").querySelector('a[href="/rulesets/first-party-001/rules/skill.athletics"]'));
const imported = read("./fixtures/multi-system/dnd-5-5e--background.acolyte.json");
const foreign = createRulesContext({ rulesetId: "dnd-5-5e", fingerprint: "synthetic-imported-transport" });
const foreignInput = createPresentationInput(foreign, envelope(imported, foreign), null);
assert.equal(registry.select(foreignInput).id, "reference.imported-origin");
assert.equal(registry.render(foreignInput).querySelector(".life-experience-reader"), null);
const old = setup(fixture("upbringing.elf.wood"), { old: true });
await assert.rejects(registry.render(old.input), /unavailable/);
assert.equal(old.calls.source, 0);
const denied = setup(fixture("upbringing.elf.wood"), { sourceError: Object.assign(Error("Denied"), { status: 403 }) });
await assert.rejects(registry.render(denied.input), /Denied/);
assert.equal(denied.calls.hierarchy, 0);
const stale = setup(fixture("background.acolyte"), { referenceError: Object.assign(Error("Snapshot stale"), { status: 409 }) });
await assert.rejects(registry.render(stale.input), /stale/);
let active = true;
const cancelled = setup(fixture("upbringing.elf.wood"), { lease: { isCurrent: () => active }, onSource: () => { active = false; } });
const previous = main.innerHTML;
assert.equal(await mountNativePresentation(main, registry, cancelled.input), false);
assert.equal(main.innerHTML, previous);
assert.equal(cancelled.calls.hierarchy, 0);
// Synthetic forward-compatible unknown field; must stay readable and inert.
const unknown = structuredClone(fixture("background.acolyte"));
unknown.benefits[0].futureField = "<img src=x onerror=alert(1)>";
const unknownView = await show(unknown);
assert.match(unknownView.textContent, /futureField|Future Field|Future field/);
assert.equal(unknownView.querySelector("img"), null);
console.log("Workstream F: 29 pinned records, captured hierarchy and Wood Elf lineage, imported adapter, missing references and lifecycle cases passed.");
