import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.invalid" });
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
const { loadConstructIndex, renderConstructReference, supportsConstructReference,
    renderConstructNavigation, registerConstructRenderers, renderConstructIndex, renderConstructIngredientLink, CONSTRUCT_TABS } =
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
    async originComponent(id) {
        calls.push(id);
        if (id === component.componentId) return component;
        // Synthetic discovery envelopes with real native definitions. Not Core capture.
        const row = envelopes.find(e => e.family === "construct-components").rows.find(r => r.id === id);
        const sourceName = Object.keys(source.records).find(path => path.endsWith("/" + id.split(".").at(-1) + ".json"));
        assert.ok(row && sourceName);
        const definition = { ...source.records[sourceName], id, kind: row.kind, componentCategory: row.componentCategory };
        return { rulesetId: context.rulesetId, fingerprint: context.fingerprint, contractVersion: 1,
            componentId: id, componentCategory: row.componentCategory, definition,
            configuration: { definitionId: id, designs: [], enhancements: [], powerSources: [], issues: [] },
            recipes: [], materialAssignmentOptions: [], materialCompatibilityAvailable: false };
    },
    async search(filters) {
        calls.push(filters);
        // Synthetic ordinary search envelope over exact source ingredient records.
        const rows = source.records["crafting-ingredients.json"];
        return { ...context, offset: filters.offset, limit: filters.limit, total: rows.length,
            rules: rows.slice(filters.offset, filters.offset + filters.limit) };
    },
    async originComponentSources(id) {
        calls.push(id);
        // Actual capture when present; otherwise a deliberately synthetic empty
        // reverse response to exercise authored detail independent of discovery.
        return envelopes.find(e => e.targetId === id) ??
            { rulesetId: context.rulesetId, fingerprint: context.fingerprint, targetId: id, contractVersion: 1, complete: true, sources: [], recipes: [], output: null };
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
for (const file of ["designs.json", "enhancements.json"]) {
    for (const option of source.records[file]) {
        const article = await renderConstructReference(input(option));
        assert.ok(article.textContent.includes(option.rulesStatus));
        assert.ok(hasLink(article, option.craftingRecipeId));
    }
}
for (const id of ["construct-component.structural-frame", "construct-component.armblade-mount", "construct-component.power-source-housing"]) {
    const row = envelopes.find(e => e.family === "construct-components").rows.find(r => r.id === id);
    const path = Object.keys(source.records).find(p => p.endsWith("/" + id.split(".").at(-1) + ".json"));
    const record = { ...source.records[path], id, kind: row.kind, componentCategory: row.componentCategory };
    const article = await renderConstructReference(input(record));
    assert.ok(article.textContent.includes(record.rulesStatus));
    assert.ok(hasLink(article, record.craftingRecipeId));
    if (id.endsWith("structural-frame")) assert.ok(hasLink(article, "crafting-recipe.construct-component.structural-frame.medium"));
    if (id.endsWith("armblade-mount")) assert.match(article.textContent, /No weapon damage is granted/);
}
const ingredientPage = await loadConstructIndex(reader, "crafting-material", null, { offset: 2, limit: 3 });
assert.equal(ingredientPage.rows.length, 3);
assert.equal(ingredientPage.complete, false);
assert.deepEqual(calls.at(-1), { category: "crafting-material", offset: 2, limit: 3 });
const grouped = await loadConstructIndex(reader, "construct-component");
const indexNode = renderConstructIndex(locomotionInput, grouped, component.componentId);
assert.equal(indexNode.querySelectorAll("a").length, grouped.rows.length);
assert.equal(indexNode.querySelector("[aria-current=page]").getAttribute("href"), "/wiki" + ruleRoute(context.rulesetId, component.componentId));
assert.equal(renderConstructIngredientLink(reader, "/wiki").getAttribute("href"), "/wiki/rulesets/first-party-001/types/crafting-material");
const mismatchedReader = { ...reader, context: { ...context, fingerprint: "other" } };
assert.equal(supportsConstructReference({ ...locomotionInput, references: mismatchedReader }), false);
const wrongTarget = { ...reader, async originComponent() { return { ...component, componentId: "construct-component.structural-frame" }; } };
await assert.rejects(renderConstructReference({ ...locomotionInput, references: wrongTarget }), /identity mismatch/);
const malformedFamily = { ...reader, async originHierarchy(family) {
    const result = envelopes.find(e => e.family === family);
    return { ...result, rows: result.rows.map(row => ({ ...row, componentCategory: null })) };
}};
await assert.rejects(loadConstructIndex(malformedFamily, "construct-component"), /category is unavailable/);
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
const denied = { ...reader, async originComponent() { throw new Error("denied"); } };
await assert.rejects(renderConstructReference({ ...locomotionInput, references: denied }), /denied/);
const staleErrorLease = lifecycle.begin(context, component.componentId);
const staleError = { ...reader, async originComponent() { lifecycle.cancel(); throw new Error("denied"); } };
assert.equal(await renderConstructReference({ ...locomotionInput, references: staleError, lifecycle: staleErrorLease }), null);
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
