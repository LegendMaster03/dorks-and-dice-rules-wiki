import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { createRulesContext, ruleRoute } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { supportsBiologicalReader, createBiologicalHierarchy, createBiologicalReader,
    biologicalDetailModel, renderBiologicalIndex, renderBiologicalDetail } from "../src/RulesWiki.Web/wwwroot/origin-biological-reader.js";

const base = new URL("./fixtures/origin-reference/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));
const captured = {};
for (const [name, digest] of [["responses.json.gz", "responsePackSha256"], ["hierarchies.json.gz", "hierarchyPackSha256"]]) {
    const bytes = readFileSync(new URL(name, base));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest[digest]);
    Object.assign(captured, JSON.parse(gunzipSync(bytes).toString("utf8")));
}
const context = createRulesContext({ rulesetId: manifest.rulesetId, fingerprint: manifest.fingerprint });
const descriptor = { id: context.rulesetId, fingerprint: context.fingerprint, capabilities: { read: true, originReferenceContractVersion: 1 } };
const calls = [];
const fixture = prefix => async (id, fingerprint, target) => {
    assert.equal(id, context.rulesetId); assert.equal(fingerprint, context.fingerprint);
    calls.push([prefix, target]);
    const value = captured[prefix + target + ".json"];
    assert.ok(value, "No captured projection for " + target);
    return structuredClone(value);
};
const api = { getNativeOriginHierarchy: fixture("hierarchy-"), getNativeOriginSource: fixture("source-") };
const reader = createRulesetReader(api, context, descriptor);
let current = true;
const controller = createBiologicalReader({ reader, isCurrent: () => current });
const tree = await controller.hierarchy();
assert.equal(tree.rows.size, 43);
assert.equal(tree.roots.filter(r => r.kind === "species").length, manifest.inventory.biological.species);
assert.equal([...tree.rows.values()].filter(r => r.kind === "ancestry").length, manifest.inventory.biological.ancestry);
assert.equal(tree.rows.get("species.human").kind, "species");
assert.equal(tree.rows.get("species.gnome").kind, "species");
assert.ok([...tree.rows.values()].some(r => r.defaultUpbringingId == null));
assert.deepEqual(tree.chain("ancestry.dragonborn.red").map(r => r.id),
    ["species.dragonborn", "ancestry.dragonborn.chromatic", "ancestry.dragonborn.red"]);
assert.deepEqual([...tree.visible("ancestry.dragonborn.red")],
    ["species.dragonborn", "ancestry.dragonborn.chromatic", "ancestry.dragonborn.red"]);
assert.equal(calls.length, 1);
assert.equal(await controller.hierarchy(), tree);
const red = await controller.select("ancestry.dragonborn.red");
assert.equal(calls.length, 2);
assert.equal(red.occurrences.find(x => x.canonicalTraitId === "trait.breath-weapon").bindings[0].authoredParameters.damageType, "fire");
assert.equal(red.effectiveProjectionAvailable, false);
assert.equal(new Set(red.occurrences.map(x => x.occurrenceKey)).size, red.occurrences.length);
const root = await controller.select("species.dragonborn");
assert.equal(root.selected.selectable, false);
assert.equal(root.direct, null);
assert.equal(red.selected.defaultUpbringingId, null);
assert.equal(root.selected.defaultUpbringingId, null);
const wood = await controller.select("ancestry.elf.wood");
assert.equal(wood.direct.fixedValues.find(x => x.slot === "walkingSpeedFeet").value, 35);
assert.match(wood.direct.candidates.find(x => x.sourceId === "species.elf" && x.slot === "walkingSpeedFeet").sourceRestriction, /override/);
assert.equal(calls.length, 4);
const common = red.occurrences.filter(x => wood.occurrences.some(y => y.canonicalTraitId && y.canonicalTraitId === x.canonicalTraitId));
assert.ok(common.length > 0, "Actual sources share canonical characteristic identities");
for (const x of common) assert.ok(wood.occurrences.some(y => y.canonicalTraitId === x.canonicalTraitId && y.occurrenceKey !== x.occurrenceKey));

// Deliberately synthetic duplicate occurrence identity and malformed parent cases.
// No synthetic data is asserted as authored gameplay.
const repeat = structuredClone(captured["source-ancestry.dragonborn.red.json"]);
const source = repeat.lineage.at(-1);
const original = repeat.lineage[0].traitOccurrences[2];
const index = source.traitOccurrences.length;
source.traitOccurrences.push({ ...original, sourceId: source.id, path: "/traits/" + index, index });
const repeated = biologicalDetailModel(tree, repeat, context).occurrences.filter(x => x.canonicalTraitId === original.canonicalTraitId);
assert.ok(repeated.length >= 2);
assert.equal(new Set(repeated.map(x => x.occurrenceKey)).size, repeated.length);
const cyclic = structuredClone(captured["hierarchy-biological.json"]);
cyclic.rows.find(x => x.id === "species.dragonborn").parentId = "ancestry.dragonborn.red";
assert.throws(() => createBiologicalHierarchy(cyclic, context), /parent chain/);
const staleContext = createRulesContext({ rulesetId: context.rulesetId, fingerprint: "synthetic-stale" });
assert.throws(() => biologicalDetailModel(tree, captured["source-ancestry.dragonborn.red.json"], staleContext), /snapshot/i);
const foreign = createRulesetReader(api, createRulesContext({ rulesetId: "dnd-5e", fingerprint: "synthetic" }));
assert.equal(supportsBiologicalReader(foreign), false);
assert.throws(() => createBiologicalReader({ reader: foreign, isCurrent: () => true }), /Authorized/);

// Synthetic delayed transport tests, actual response payloads unchanged.
let release;
const delayedReader = createRulesetReader({ ...api, getNativeOriginSource: async () => new Promise(resolve => { release = resolve; }) }, context, descriptor);
const delayed = createBiologicalReader({ reader: delayedReader, isCurrent: () => current });
await delayed.hierarchy();
const pending = delayed.select("ancestry.dragonborn.red");
while (!release) await Promise.resolve();
current = false;
release(captured["source-ancestry.dragonborn.red.json"]);
assert.equal(await pending, null);
delayed.dispose();
current = true;

// DOM harness: scoped exact links, selected state, native keyboard controls,
// ancestor visibility and state restoration; layout owner runs real browser acceptance.
const dom = new JSDOM("<main></main>", { url: "https://wiki.example.test/" });
for (const key of ["window", "document", "Node", "NodeFilter", "Element", "HTMLElement", "Event"]) globalThis[key] = dom.window[key];
const input = { context, references: reader, hrefForRule: id => ruleRoute(context.rulesetId, id), lifecycle: { isCurrent: () => current } };
const state = {};
let navigated;
const mount = document.querySelector("main");
const indexView = renderBiologicalIndex(tree, input, { selectedId: red.selected.id, state, onNavigate: id => { navigated = id; } });
mount.append(indexView);
assert.equal(indexView.querySelector('[aria-current="page"]').textContent, red.selected.name);
assert.ok([...indexView.querySelectorAll("details")].filter(x => x.open).length >= 2);
assert.ok(indexView.querySelector("summary"));
const search = indexView.querySelector('input[type="search"]');
search.value = "ancestry.dragonborn.red"; search.dispatchEvent(new Event("input"));
assert.equal(indexView.querySelectorAll("a").length, 3);
const parent = indexView.querySelector('a[href="' + ruleRoute(context.rulesetId, "species.dragonborn") + '"]');
parent.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
assert.equal(navigated, "species.dragonborn");
const rerender = renderBiologicalIndex(tree, input, { selectedId: red.selected.id, state });
assert.equal(rerender.querySelector("input").value, search.value);
const view = renderBiologicalDetail(red, input);
mount.append(view);
assert.ok(view.querySelector('a[href="' + ruleRoute(context.rulesetId, "trait.breath-weapon") + '"]'));
assert.equal(view.querySelectorAll("[data-occurrence-key]").length, red.occurrences.length);
assert.match(view.textContent, /Reference only/);
assert.match(view.textContent, /Inherited reference occurrence/);
assert.match(view.textContent, /fire/i);
assert.match(view.textContent, /Configured source bindings/);
assert.match(view.textContent, /No suggested Upbringing is authored for this record/);
assert.ok(view.querySelector('a[href="' + ruleRoute(context.rulesetId, "rule.creature-origination") + '"]'));
assert.match(renderBiologicalDetail(root, input).textContent, /Not directly selectable/);
assert.match(renderBiologicalDetail(wood, input).textContent, /35/);
assert.throws(() => renderBiologicalDetail(red, { ...input, context: staleContext }), /context mismatch/);
assert.throws(() => renderBiologicalIndex(tree, { ...input, context: staleContext }), /context mismatch/);
assert.equal(view.querySelectorAll(".ruleset-package-attribution").length, 0);
controller.dispose();
assert.equal(await controller.select(red.selected.id), null);

// Standalone HTML evidence for integration review, not a live deployed preview.
const previewDir = process.argv[2];
if (previewDir) {
    mkdirSync(previewDir, { recursive: true });
    for (const width of [1280, 390]) {
        const page = new JSDOM('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
        const doc = page.window.document;
        const title = doc.createElement("title"); title.textContent = "Biological reader isolated harness"; doc.head.append(title);
        const style = doc.createElement("style");
        style.textContent = "body{font:16px system-ui;margin:16px;max-width:" + width + "px}main{display:grid;grid-template-columns:" +
            (width > 600 ? "minmax(220px,1fr) minmax(0,3fr)" : "1fr") + ";gap:24px}ul{list-style:none;padding-left:16px}section{margin:16px 0}small{color:#555}a[aria-current]{font-weight:bold}input{max-width:100%}";
        doc.head.append(style);
        const main = doc.createElement("main");
        main.append(doc.importNode(rerender, true), doc.importNode(view, true)); doc.body.append(main);
        writeFileSync(previewDir + "/biological-" + width + ".html", page.serialize());
    }
}
console.log("Biological reference reader captured projection and isolated DOM tests passed.");
