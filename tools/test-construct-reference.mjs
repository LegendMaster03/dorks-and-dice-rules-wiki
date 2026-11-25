import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.invalid" });
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
const { loadConstructIndex, renderConstructReference, supportsConstructReference,
    renderConstructNavigation, registerConstructRenderers, CONSTRUCT_TABS } =
    await import("../src/RulesWiki.Web/wwwroot/native-construct-reference.js");
const { createRulesContext, ruleRoute, createRenderLifecycle } =
    await import("../src/RulesWiki.Web/wwwroot/rules-context.js");
const { createNativeRendererRegistry } = await import("../src/RulesWiki.Web/wwwroot/native-presentation.js");
const fixtureRoot = new URL("./fixtures/origin-reference/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", fixtureRoot), "utf8"));
const actual = Object.assign({}, ...["responses.json.gz", "hierarchies.json.gz",
    "construct-characteristic-hierarchies.json.gz"].map(file =>
    JSON.parse(gunzipSync(readFileSync(new URL(file, fixtureRoot))).toString("utf8"))));
const envelopes = Object.values(actual);
const context = createRulesContext({ rulesetId: manifest.rulesetId, fingerprint: manifest.fingerprint });
const source = JSON.parse(readFileSync(new URL("./fixtures/construct-reference/source-records.json", import.meta.url), "utf8"));
const component = envelopes.find(e => e.componentId === "construct-component.locomotion-unit");
assert.ok(component, "Actual captured locomotion configuration");
let calls = [];
const reader = { context, originReferenceContractVersion: 1,
    async originHierarchy(family) { calls.push(family); const value = envelopes.find(e => e.family === family); assert.ok(value); return value; },
    async originComponent(id) { calls.push(id); assert.equal(id, component.componentId); return component; },
    async originComponentSources(id) {
        calls.push(id);
        // Actual capture when present; otherwise a deliberately synthetic empty
        // reverse response to exercise authored detail independent of discovery.
        return envelopes.find(e => e.targetId === id) ??
            { rulesetId: context.rulesetId, fingerprint: context.fingerprint, targetId: id, complete: true, sources: [], recipes: [], output: null };
    }
};
function input(record, kind = record.kind, id = record.id, refs = reader) {
    return { context, rule: { id, name: record.name, kind }, record,
        references: refs, hrefForRule: target => "/wiki" + ruleRoute(context.rulesetId, target),
        source: null, sourcePackage: null, lifecycle: null };
}
for (const tab of CONSTRUCT_TABS) {
    calls = [];
    const index = await loadConstructIndex(reader, tab.kind);
    assert.equal(calls.length, 1);
    assert.equal(index.rows.length, tab.kind === "construct-component" ?
        manifest.inventory["construct-components"] : manifest.inventory["construct-options"][tab.kind]);
    assert.ok(index.rows.every(row => row.kind === tab.kind));
    if (tab.kind === "construct-component") {
        assert.ok(index.groups.some(g => g.category === "integrated-weapon-mounts"));
        assert.ok(index.groups.some(g => g.category === "storage-and-transport"));
        assert.ok(index.groups.some(g => g.category === "equipment-mounts"));
        assert.equal(index.groups.flatMap(g => g.rows).length, index.rows.length);
    }
}
const nav = renderConstructNavigation(reader, "construct-component", "/wiki");
assert.equal(nav.querySelectorAll("a").length, 6);
assert.equal(nav.querySelector("[aria-current=page]").textContent, "Components");
const registry = createNativeRendererRegistry();
registerConstructRenderers(registry);
const locomotionInput = input(component.definition, "construct-component", component.componentId);
assert.equal(registry.select(locomotionInput).id, "origin.construct-reference");
calls = [];
const detail = await registry.render(locomotionInput);
assert.deepEqual(calls, [component.componentId]);
assert.match(detail.textContent, /Additional units do not independently grant extra movement speed/);
assert.match(detail.textContent, /Physical suitability/);
const hasLink = (article, id) => [...article.querySelectorAll("a")].some(a => a.getAttribute("href") === "/wiki" + ruleRoute(context.rulesetId, id));
assert.ok(hasLink(detail, "trait.construct.ordinary-ground-movement"));
assert.ok(hasLink(detail, "crafting-recipe.construct-component.locomotion-unit"));
assert.ok(hasLink(detail, "construct-design.wheeled-drive"));
for (const power of source.records["power-sources.json"]) {
    const article = await renderConstructReference(input(power));
    assert.ok(article.textContent.includes(power.rulesStatus));
    assert.ok(article.textContent.includes(power.description));
    assert.ok(hasLink(article, power.craftingRecipeId));
    if (power.operatingPrinciple === "soul-energy") assert.match(article.textContent, /intentionally-unspecified/);
    if (power.operatingPrinciple === "infernal") assert.match(article.textContent, /not-yet-authored/);
}
for (const recipe of source.records["crafting-recipes.json"]) {
    const article = await renderConstructReference(input(recipe));
    assert.ok(hasLink(article, recipe.producesDefinitionId));
    assert.ok(hasLink(article, recipe.stages[0].competencyId));
    if (recipe.stages.length > 1) {
        assert.ok(article.textContent.indexOf("prepare-medium") < article.textContent.indexOf("assemble"));
        assert.ok(hasLink(article, "crafting-material.alchemical-reagent"));
        assert.ok(hasLink(article, "crafting-material.activated-medium"));
    }
}
const ingredient = source.records["crafting-ingredients.json"][0];
const ingredientArticle = await renderConstructReference(input(ingredient));
assert.match(ingredientArticle.textContent, /does not yet provide reverse recipe-input/);
const material = source.records["materials.json"][0];
assert.match((await renderConstructReference(input(material))).textContent, /does not yet provide reverse recipe-input/);
assert.equal(supportsConstructReference(input(component.definition, "construct-component", component.componentId,
    { ...reader, originReferenceContractVersion: null })), false);
const foreign = { ...locomotionInput, context: { ...context, rulesetId: "dnd-5e" } };
assert.equal(supportsConstructReference(foreign), false);
const lifecycle = createRenderLifecycle();
const lease = lifecycle.begin(context, component.componentId);
const staleReader = { ...reader, async originComponent() { lifecycle.cancel(); return component; } };
assert.equal(await renderConstructReference({ ...locomotionInput, references: staleReader, lifecycle: lease }), null);
const staleIndexLease = lifecycle.begin(context, component.componentId);
const staleIndexReader = { ...reader, async originHierarchy(family) {
    lifecycle.cancel(); return envelopes.find(e => e.family === family);
}};
assert.equal(await loadConstructIndex(staleIndexReader, "construct-component", staleIndexLease), null);
const staleSnapshot = { ...reader, async originHierarchy(family) {
    return { ...envelopes.find(e => e.family === family), fingerprint: "other" };
}};
await assert.rejects(loadConstructIndex(staleSnapshot, "construct-component"), /snapshot/);
console.log("Construct reference adapter tests passed.");
