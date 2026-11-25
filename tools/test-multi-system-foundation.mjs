import fs from "node:fs";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createRulesContext, referenceKey, readingKey, snapshotKey, ruleRoute, catalogRoute, categoryRoute, parseQualifiedRoute, discoverRulesContext, createRenderLifecycle } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader, createPresentationInput, createNativeRendererRegistry, renderStructuredContent, mountNativePresentation } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { renderNativeDetail, createWikiNativeRendererRegistry } from "../src/RulesWiki.Web/wwwroot/native-rule-detail.js";
import { renderRuleDetailPane, cancelNativeDetailRender } from "../src/RulesWiki.Web/wwwroot/rules-browser-detail.js";
import { parseToolRoute } from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";
const context = id => createRulesContext({ rulesetId: id, fingerprint: "fixture-snapshot" });
const a = context("first-party-001"), b = context("dnd-5e"), id = "class.warlock";
assert.notEqual(referenceKey(a.rulesetId, id), referenceKey(b.rulesetId, id));
assert.notEqual(readingKey(a, id), readingKey(b, id));
assert.notEqual(readingKey(a, id), readingKey({ ...a, fingerprint: "other" }, id));
assert.notEqual(snapshotKey(a, "x"), snapshotKey({ ...a, campaignId: "c", campaignRevisionId: "r" }, "x"));
assert.throws(() => snapshotKey({ ...a, campaignId: "c" }), /revision/);
assert.throws(() => createRulesContext({ ...a, campaignRevisionId: "r" }), /Campaign/);
assert.deepEqual(parseQualifiedRoute(ruleRoute(b.rulesetId, id)), { status: "valid", rulesetId: b.rulesetId, kind: "rule", ruleId: id });
assert.equal(parseQualifiedRoute(catalogRoute(b.rulesetId)).kind, "catalog");
assert.equal(parseQualifiedRoute(categoryRoute(b.rulesetId, "class")).category, "class");
assert.equal(parseQualifiedRoute("/rulesets/unknown/rules/%ZZ").status, "invalid");
assert.throws(() => ruleRoute("..", id));
assert.equal(parseToolRoute("/rules/class.warlock").conceptKey, id);
assert.equal(parseToolRoute(ruleRoute(a.rulesetId, id)).conceptKey, id);
assert.equal(parseToolRoute(categoryRoute(a.rulesetId, "class")).entityType, "class");
assert.equal(parseToolRoute(ruleRoute(b.rulesetId, id)).unsupportedRulesContext, true);
assert.equal(parseToolRoute("/rulesets/unknown").unsupportedRulesContext, true);
const calls = [];
const response = { rulesetId: b.rulesetId, fingerprint: b.fingerprint, rule: { id, name: "Warlock", kind: "class", definition: { id, hd: { faces: 8 }, entries: ["<img src=x onerror=alert(1)>"] } } };
const api = {
    getNativeRulesets: async () => ({ rulesets: [{ id: b.rulesetId, fingerprint: b.fingerprint, capabilities: { read: true } }] }),
    getNativeRule: async (...args) => { calls.push(args); return response; },
    searchNativeRules: async () => ({ rulesetId: b.rulesetId, fingerprint: b.fingerprint, rules: [], total: 0 })
};
await assert.rejects(discoverRulesContext(api, "unknown"), /unavailable/);
const reader = createRulesetReader(api, await discoverRulesContext(api, b.rulesetId));
assert.throws(() => createRulesetReader(api, { ...b, campaignId: "c" }), /Campaign/);
await reader.search();
assert.deepEqual(await reader.resolve(id), response);
assert.deepEqual(calls, [[b.rulesetId, id]]);
await assert.rejects(reader.resolve("class.other"), /envelope/);
await assert.rejects(createRulesetReader(api, a).resolve(id), /identity/);
const dom = new JSDOM("<main></main>");
for (const key of ["window", "document", "Node", "Element", "HTMLElement", "Event"]) globalThis[key] = dom.window[key];
const registry = createNativeRendererRegistry();
registry.register({ id: "hd-class", supports: x => x.rule.kind === "class" && !!x.record.hd, render: () => document.createElement("article") });
const input = createPresentationInput(b, response, reader);
assert.equal(registry.select(input).id, "hd-class");
assert.throws(() => createPresentationInput(b, response, createRulesetReader(api, a)), /match/);
const generic = createNativeRendererRegistry();
const rendered = await generic.render(input);
assert.equal(rendered.querySelector("img"), null);
assert.match(rendered.textContent, /<img/);
const table = renderStructuredContent({ type: "table", colLabels: ["A"], rows: [["B"]] });
assert.equal(table.querySelector("th").textContent, "A");
assert.equal(table.querySelector("td").textContent, "B");
const lifecycle = createRenderLifecycle(), old = lifecycle.begin(b, id);
let release;
const delayed = createNativeRendererRegistry(() => new Promise(resolve => { release = resolve; }));
const container = document.querySelector("main");
const pending = mountNativePresentation(container, delayed, { ...input, lifecycle: old });
const current = lifecycle.begin(a, id);
assert.equal(old.signal.aborted, true);
release(document.createElement("article"));
assert.equal(await pending, false);
assert.equal(container.childElementCount, 0);
assert.equal(current.isCurrent(), true);
lifecycle.cancel();
assert.equal(current.isCurrent(), false);
// The live dispatcher uses the same registry, not a parallel fixture-only path.
const activeRegistry = createWikiNativeRendererRegistry();
assert.equal(activeRegistry.select(input).id, "generic");
const firstParty = { rulesetId: a.rulesetId, fingerprint: a.fingerprint,
    rule: { id: "condition.blinded", name: "Blinded", kind: "condition", definition: { description: "Cannot see." } } };
assert.equal(renderNativeDetail(container, firstParty, () => {}), true);
assert.ok(container.querySelector(".rules-core-detail-context-card"), "First-party compatibility layout is unchanged.");
assert.equal(renderNativeDetail(container, response, () => {}), true);
assert.match(container.textContent, /Generic native reference/);
assert.ok(container.querySelector(".rules-core-library-mobile-back"));
assert.ok(container.querySelector(".rules-core-library-detail-body"));
const app = {
    api, rulesContext: b, hostContext: { toolBasePath: "/tools/rules-wiki" },
    presentRenderedFragment() { this.presented = (this.presented ?? 0) + 1; }
};
app.nativeRendererRegistry = createWikiNativeRendererRegistry(app);
let finishRender, oldSignal;
app.nativeRendererRegistry.register({ id: "foreign-structured-class", supports: value => value.rule.kind === "class" && !!value.record.hd,
    render: value => {
        assert.equal(value.context.rulesetId, b.rulesetId);
        assert.equal(value.hrefForRule(id), "/tools/rules-wiki/rulesets/dnd-5e/rules/class.warlock");
        oldSignal = value.lifecycle.signal;
        return new Promise(resolve => { finishRender = resolve; });
    } });
let serial = 1;
const slow = renderRuleDetailPane(app, container, id, "global", serial, () => serial, () => {});
for (let i = 0; i < 10 && !finishRender; i++) await Promise.resolve();
assert.equal(typeof finishRender, "function", "Registered renderer is reached by the actual detail pane.");
serial++;
app.rulesContext = a;
app.api = { ...api, getNativeRule: async () => firstParty };
await renderRuleDetailPane(app, container, firstParty.rule.id, "global", serial, () => serial, () => {});
assert.equal(oldSignal.aborted, true);
assert.match(container.textContent, /Blinded/);
const stale = document.createElement("p"); stale.textContent = "Stale foreign class";
finishRender(stale);
await slow;
assert.doesNotMatch(container.textContent, /Stale foreign class/);
assert.equal(app.presented, 1);
app.rulesContext = b;
await renderRuleDetailPane(app, container, id, "global", ++serial, () => serial, () => {});
assert.match(container.textContent, /did not match the requested snapshot/);
// A future catalog selector must retain the reader returned by discovery, not
// rebuild it and lose package-level descriptor fields.
app.rulesContext = a;
const exactReader = Object.freeze({ ...createRulesetReader(app.api, a), marker: "authorized-reader" });
app.rulesetReader = exactReader;
app.nativeRendererRegistry.register({ id: "bound-reader-probe", priority: 100,
    supports: value => value.rule.kind === "condition",
    render: value => {
        assert.equal(value.references, exactReader);
        const node = document.createElement("p"); node.textContent = "Bound reader preserved";
        return node;
    }
});
await renderRuleDetailPane(app, container, firstParty.rule.id, "global", ++serial, () => serial, () => {});
assert.match(container.textContent, /Bound reader preserved/);
app.rulesContext = b; // The old authorized reader must not be reused.
await renderRuleDetailPane(app, container, id, "global", ++serial, () => serial, () => {});
assert.match(container.textContent, /does not match the active rules context/);
cancelNativeDetailRender(app);

const manifest = JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/manifest.json", import.meta.url)));
const identities = new Set();
for (const fixture of manifest.fixtures) {
    const record = JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/" + fixture.file, import.meta.url)));
    assert.equal(record.id, fixture.nativeEntityId);
    assert.equal(fixture.sourceRevision, manifest.sourceRevision);
    assert.ok(fixture.sourceFile.startsWith("data/rulesets/" + fixture.rulesetId + "/native/"));
    identities.add(referenceKey(fixture.rulesetId, record.id));
    const ctx = context(fixture.rulesetId);
    const envelope = { rulesetId: ctx.rulesetId, fingerprint: ctx.fingerprint,
        rule: { id: record.id, kind: record.kind, name: record.name, definition: record } };
    const fixtureInput = createPresentationInput(ctx, envelope, null);
    const view = await generic.render(fixtureInput);
    assert.equal(view.querySelector("h2").textContent, record.name);
    assert.equal(view.querySelector("script"), null);
}
assert.equal(identities.size, manifest.fixtures.length);
assert.equal(manifest.fixtures.filter(x => x.nativeEntityId === id).length, 3);
assert.equal(manifest.syntheticFixtures.length, 1);
const kaiju = JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/" + manifest.syntheticFixtures[0].file, import.meta.url)));
assert.equal(kaiju.blockType, "kaiju");
assert.equal(kaiju.kaiju.vulnerableAreas.length, 2);
assert.equal(manifest.syntheticFixtures[0].nativeEntityId, null);
console.log("Multi-system foundation contracts passed.");
