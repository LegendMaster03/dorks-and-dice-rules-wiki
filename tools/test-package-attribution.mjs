import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createRulesetReader, createPresentationInput, renderGenericNative } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { discoverPackageContext, packageDescriptor, packageDisplayName, renderPackageAttribution } from "../src/RulesWiki.Web/wwwroot/package-attribution.js";
const dom = new JSDOM("<main></main>");
globalThis.document = dom.window.document;
const descriptor = (id, name, licenseIdentifier, licenseUrl) => ({
    id, fingerprint: "snapshot-" + id, capabilities: { read: true, write: false },
    metadata: { rulesetId: id, displayName: name, licenseIdentifier, licenseUrl,
        attributionStatement: "Notice for " + id, originalSources: ["https://example.org/srd", "javascript:alert(1)", "file:///private/file"],
        modificationNotices: ["Normalized native data"], acknowledgments: ["<script>never execute</script>"],
        reviewReference: "internal-marker" }
});
const sets = [
    descriptor("first-party-001", "Dorks & Dice", null, null),
    descriptor("dnd-5e", "D&D SRD 5.1", "CC-BY-4.0", "https://creativecommons.org/licenses/by/4.0/legalcode"),
    descriptor("dnd-5-5e", "D&D SRD 5.2.1", "CC-BY-4.0", "https://creativecommons.org/licenses/by/4.0/legalcode"),
    descriptor("fate-condensed", "Fate Condensed", "CC-BY-3.0", "https://creativecommons.org/licenses/by/3.0/")
];
const api = { getNativeRulesets: async () => ({ rulesets: sets }) };
for (const entry of sets) {
    const { context, descriptor: d } = await discoverPackageContext(api, entry.id);
    assert.equal(packageDisplayName(context, d), entry.metadata.displayName);
    const view = renderPackageAttribution(context, d);
    assert.match(view.textContent, new RegExp("Notice for " + entry.id));
    assert.match(view.textContent, /Normalized native data/);
    assert.equal(view.querySelector("script"), null);
    assert.doesNotMatch(view.textContent, /internal-marker|file:\/\/\/private/);
    assert.equal(view.querySelector('a[href^="javascript:"]'), null);
    if (entry.metadata.licenseUrl) assert.equal(view.querySelector("a").href, entry.metadata.licenseUrl);
    else assert.doesNotMatch(view.textContent, /CC-BY/);
    const reader = createRulesetReader(api, context, d);
    const rule = { id: "rule.example", name: "Example", kind: "rule", definition: { source: "Entity-specific source" } };
    const envelope = { rulesetId: context.rulesetId, fingerprint: context.fingerprint, rule };
    const detail = renderGenericNative(createPresentationInput(context, envelope, reader));
    assert.match(detail.textContent, /Entity-specific source/);
    assert.match(detail.textContent, new RegExp("Notice for " + entry.id));
    assert.equal(packageDescriptor(context, { ...d, fingerprint: "old" }), null);
    assert.equal(packageDescriptor(context, { ...d, capabilities: { read: false } }), null);
    assert.equal(packageDescriptor(context, { ...d, metadata: { ...d.metadata, rulesetId: "other" } }).metadata, null);
    const other = sets.find(x => x.id !== entry.id);
    assert.equal(packageDescriptor(context, other), null);
    assert.doesNotMatch(renderPackageAttribution(context, other).textContent, /Notice for/);
    assert.match(renderPackageAttribution(context, { ...d, metadata: undefined }).textContent, /unavailable/);
}
await assert.rejects(discoverPackageContext(api, "missing"), /unavailable/);
await assert.rejects(discoverPackageContext({ getNativeRulesets: async () => ({ rulesets: [sets[0], sets[0]] }) }, sets[0].id), /unavailable/);
assert.throws(() => renderPackageAttribution({ rulesetId: sets[0].id, fingerprint: sets[0].fingerprint, campaignId: "c" }, sets[0]), /Campaign/);
console.log("Package attribution contracts passed.");
