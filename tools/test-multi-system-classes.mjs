// Imported class reading is tested against the pinned native Core records, not
// a simulated edition schema. Only the transport and snapshot IDs are synthetic.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { createRulesContext, createRenderLifecycle, ruleRoute } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader, createPresentationInput } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { renderNativeDetail, createWikiNativeRendererRegistry } from "../src/RulesWiki.Web/wwwroot/native-rule-detail.js";
import { createImportedClassPresentation, createImportedFeatureResolver } from "../src/RulesWiki.Web/wwwroot/native-class-presentation-model.js";
import { classReturnLink } from "../src/RulesWiki.Web/wwwroot/native-class-view-state.js";

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const manifest = await read("./fixtures/class-presentation/manifest.json");
const recordsByRuleset = new Map();
for (const fixture of manifest.fixtures) {
    assert.equal(fixture.sourceRevision, manifest.sourceRevision);
    const rows = await read("./fixtures/class-presentation/" + fixture.file);
    const records = recordsByRuleset.get(fixture.rulesetId) ?? new Map();
    for (const row of rows) {
        assert.ok(!records.has(row.id), "Fixture identity must be unique within a catalog.");
        records.set(row.id, row);
    }
    recordsByRuleset.set(fixture.rulesetId, records);
}
const firstParty = await read("./fixtures/multi-system/first-party-001--class.warlock.json");
const fate = await read("./fixtures/multi-system/fate-condensed--section.taking-action-rolling-the-dice.json");
recordsByRuleset.set("first-party-001", new Map([[firstParty.id, firstParty]]));
recordsByRuleset.set("fate-condensed", new Map([[fate.id, fate]]));
const dom = new JSDOM('<main class="rules-core-library-detail" id="detail"></main>', {
    url: "https://site.test/rulesets/dnd-5e/rules/class.warlock", pretendToBeVisual: true
});
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "NodeFilter", "Event", "MouseEvent"])
    globalThis[key] = dom.window[key];
const container = document.querySelector("#detail");
const contextFor = (rulesetId, fingerprint = "same-test-fingerprint") =>
    createRulesContext({ rulesetId, fingerprint });
const envelope = (context, record) => ({ rulesetId: context.rulesetId, fingerprint: context.fingerprint,
    rule: { id: record.id, kind: record.kind, name: record.name, definition: record } });
const lookup = (context, id) => {
    const record = recordsByRuleset.get(context.rulesetId)?.get(id);
    assert.ok(record, "Unknown fixture reference: " + context.rulesetId + " / " + id);
    return record;
};
const reads = [];
const searches = [];
const readerFor = (context, overrides = {}) => createRulesetReader({
    async getNativeRule(rulesetId, id) {
        assert.equal(rulesetId, context.rulesetId);
        reads.push([rulesetId, id]);
        return envelope(context, lookup(context, id));
    },
    async searchNativeRules(rulesetId, { category, offset = 0, limit = 100 }) {
        assert.equal(rulesetId, context.rulesetId);
        searches.push([rulesetId, category, offset, limit]);
        const rows = [...recordsByRuleset.get(rulesetId).values()].filter(row => row.kind === category);
        return { rulesetId, fingerprint: context.fingerprint, total: rows.length,
            rules: rows.slice(offset, offset + limit).map(({ id, name, kind }) => ({ id, name, kind })) };
    },
    ...overrides
}, context);
const lifecycle = createRenderLifecycle();
const registry = createWikiNativeRendererRegistry();
const mount = (context, id, reader = readerFor(context), fragment = "") => {
    window.history.replaceState({}, "", ruleRoute(context.rulesetId, id) + fragment);
    const detail = envelope(context, lookup(context, id));
    const lease = lifecycle.begin(context, id);
    assert.equal(renderNativeDetail(container, detail, () => {}, null, { context, reader, lifecycle: lease }), true);
    return container.querySelector(".native-class-reference");
};
const delay = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitFor(check, description) {
    for (let tries = 0; tries < 80; tries++) {
        if (check()) return;
        await delay();
    }
    assert.fail("Timed out: " + description);
}
function open(disclosure) {
    assert.ok(disclosure);
    disclosure.open = true;
    disclosure.dispatchEvent(new Event("toggle"));
}
function clickWithoutNavigation(link) {
    link.addEventListener("click", event => event.preventDefault(), { once: true });
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}
function namedDetails(root, name) {
    return [...root.querySelectorAll("details")].find(item => item.querySelector(":scope > summary")?.textContent === name);
}
function featureCard(root, name) {
    return [...root.querySelectorAll(".native-class-feature")].find(card => card.querySelector("summary")?.textContent === name);
}
const legacy = contextFor("dnd-5e"), modern = contextFor("dnd-5-5e"), original = contextFor("first-party-001");
let referenceCount = 0;
for (const context of [legacy, modern]) {
    const reader = readerFor(context);
    for (const record of recordsByRuleset.get(context.rulesetId).values()) {
        if (!["class", "subclass"].includes(record.kind)) continue;
        const model = createImportedClassPresentation(record);
        assert.ok(model);
        assert.equal(model.unresolvedEntries.length, 0);
        const sourceBefore = JSON.stringify(record);
        const resolve = createImportedFeatureResolver(model, reader, context);
        for (const feature of model.features.values()) {
            const result = await resolve(feature.key);
            assert.equal(result.rule.name, feature.name);
            assert.equal(result.rule.definition.level, feature.level);
            assert.ok(record.catalogReferences.includes(result.rule.id));
            referenceCount++;
        }
        assert.equal(JSON.stringify(record), sourceBefore, "Presentation must not mutate native records.");
    }
}
assert.equal(referenceCount, 140);
const oldWarlock = createImportedClassPresentation(lookup(legacy, "class.warlock"));
const newWarlock = createImportedClassPresentation(lookup(modern, "class.warlock"));
assert.equal([...oldWarlock.features.values()].find(x => x.gainSubclassFeature).level, 1);
assert.equal([...newWarlock.features.values()].find(x => x.gainSubclassFeature).level, 3);
assert.equal(oldWarlock.record.optionalfeatureProgression[0].progression[0], 0);
assert.equal(newWarlock.record.optionalfeatureProgression[0].progression[0], 1);
assert.equal(oldWarlock.spellList.reduce((sum, group) => sum + group.spellIds.length, 0), 64);
assert.equal(newWarlock.spellList.reduce((sum, group) => sum + group.spellIds.length, 0), 72);
assert.equal(createImportedClassPresentation(firstParty), null);
assert.equal(createImportedClassPresentation(fate), null);
assert.equal(createImportedClassPresentation(lookup(legacy, "class.fighter")).tables.length, 0);
assert.equal(createImportedClassPresentation(lookup(modern, "class.fighter")).tables.length, 1);
for (const context of [legacy, modern]) {
    assert.equal(createImportedClassPresentation(lookup(context, "class.wizard")).tables.length, 2);
    const input = createPresentationInput(context, envelope(context, lookup(context, "class.warlock")), readerFor(context));
    assert.equal(registry.select(input).id, "class.imported-family");
}
let firstRoot = mount(original, "class.warlock");
assert.match(firstRoot.textContent, /Alpha 0.3.1/);
assert.match(firstRoot.textContent, /Class customization/);
assert.ok(firstRoot.querySelector(".native-class-table"));
assert.equal(firstRoot.querySelectorAll(".native-class-customization-system").length, 3);

// Both imported Warlocks share the existing class surface, but never their
// native definitions, feature links, or scoped reading state.
for (const context of [legacy, modern]) {
    reads.length = 0;
    let root = mount(context, "class.warlock");
    await delay();
    assert.equal(reads.length, 0, "Initial class mount must not fetch feature definitions.");
    assert.equal(root.querySelector("h2").textContent, "Warlock");
    assert.doesNotMatch(root.textContent, /Alpha 0.3.1/);
    assert.ok(root.querySelector(".native-class-navigation .wiki-mobile-section-select"));
    assert.ok(root.querySelector(".native-class-table-scroll[tabindex='0']"));
    assert.ok(root.querySelector("#native-class-spells"));
    const levelZero = root.querySelector("#native-class-spell-group-0");
    assert.ok(levelZero.querySelector('a[href="' + ruleRoute(context.rulesetId, "spell.eldritch-blast") + '"]'));
    const card = featureCard(root, "Pact Magic");
    assert.ok(card);
    assert.ok(!card.querySelector(".native-class-rule-link"));
    const fragment = root.querySelector('a[href="#' + card.id + '"]');
    clickWithoutNavigation(fragment);
    await waitFor(() => card.querySelector(".native-class-rule-link"), "lazy Pact Magic");
    const link = card.querySelector(".native-class-rule-link");
    const featureId = "class-feature.warlock.pact-magic.1";
    assert.equal(link.getAttribute("href"), ruleRoute(context.rulesetId, featureId));
    assert.ok(card.open);
    assert.match(window.location.hash, /^#native-class-feature-/);
    clickWithoutNavigation(link);
    assert.ok(classReturnLink("class.warlock", context.fingerprint, context));
    assert.equal(classReturnLink("class.warlock", "changed", contextFor(context.rulesetId, "changed")), null);
    const otherContext = context === legacy ? modern : original;
    assert.equal(classReturnLink("class.warlock", otherContext.fingerprint, otherContext), null);
    const featureRoot = mount(context, featureId);
    assert.equal(featureRoot.querySelector(".wiki-context-back")?.textContent, "Back to Warlock");
    assert.match(featureRoot.querySelector(".wiki-context-back").getAttribute("href"), new RegExp("^/rulesets/" + context.rulesetId + "/rules/class.warlock#native-class-"));
    root = mount(context, "class.warlock");
    await waitFor(() => featureCard(root, "Pact Magic")?.open, "restored feature state");
    const subclasses = namedDetails(root, "Browse subclasses");
    open(subclasses);
    await waitFor(() => subclasses.querySelector('a[href="' + ruleRoute(context.rulesetId, "subclass.warlock.fiend") + '"]'), "subclass relationship");
    const invocations = namedDetails(root, "Browse Eldritch Invocations");
    open(invocations);
    await waitFor(() => invocations.querySelector('a[href="' + ruleRoute(context.rulesetId, "optional-feature.agonizing-blast") + '"]'), "invocation option relationship");
    assert.match(invocations.textContent, /Prerequisites/);
    if (context === legacy) {
        const readsBefore = reads.length, searchesBefore = searches.length;
        const pacts = namedDetails(root, "Browse Pact Boon");
        open(pacts);
        await waitFor(() => pacts.getAttribute("data-options-ready") === "true", "shared Pact Boon catalog");
        assert.ok(pacts.querySelector("a"), "Pact Boon records remain readable.");
        assert.equal(reads.length, readsBefore, "Another option group must reuse the mounted category reads.");
        assert.equal(searches.length, searchesBefore, "Another option group must not repeat category pagination.");
    }
    root = mount(context, "subclass.warlock.fiend");
    assert.ok(root.querySelector("#native-class-specializations a"));
    assert.ok(root.querySelector(".native-class-feature"));
    root = mount(context, "class.fighter");
    assert.equal(root.querySelectorAll(".native-class-table").length, context === legacy ? 1 : 2);
    assert.equal(Boolean(root.querySelector("#native-class-spells")), false);
    root = mount(context, "class.wizard");
    assert.equal(root.querySelectorAll(".native-class-table").length, 3);
    assert.ok(root.querySelector("#native-class-spells"));
}

// A stale fingerprint can not mount or produce an exact feature link.
const mismatchReader = readerFor(modern, { async getNativeRule(rulesetId, id) {
    return { ...envelope(modern, lookup(modern, id)), fingerprint: "changed" };
}});
let root = mount(modern, "class.warlock", mismatchReader);
let card = featureCard(root, "Pact Magic");
open(card);
await waitFor(() => /Feature relationship unavailable/.test(card.textContent), "stale feature rejection");
assert.equal(card.querySelector(".native-class-rule-link"), null);

// An old catalog request completing after a new selection must not mutate
// even the detached feature content, nor the new mounted class.
let releases = [];
const delayed = readerFor(legacy, { getNativeRule(rulesetId, id) {
    return new Promise(resolve => releases.push(() => resolve(envelope(legacy, lookup(legacy, id)))));
}});
root = mount(legacy, "class.warlock", delayed);
card = featureCard(root, "Pact Magic");
open(card);
await waitFor(() => releases.length > 0, "deferred feature request");
const before = card.textContent;
const replacement = mount(modern, "class.warlock");
for (const release of releases) release();
await delay();
assert.equal(card.textContent, before);
assert.equal(card.querySelector(".native-class-rule-link"), null);
assert.equal(featureCard(replacement, "Pact Magic").querySelector(".native-class-rule-link"), null);

const fateContext = contextFor("fate-condensed");
assert.equal(mount(fateContext, fate.id), null);
assert.ok(container.textContent.includes(fate.name));
lifecycle.cancel();
dom.window.close();
console.log("Native multi-system classes: 140 exact feature relationships, class family tables, lazy reads, scoped return state and classless fallback passed.");
