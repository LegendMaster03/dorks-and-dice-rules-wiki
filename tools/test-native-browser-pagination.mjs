// Browser adapter contract against pinned native fixture records. The fake
// Core exposes only the existing private operation shapes; it is not a policy change.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authorizedRulesetDescriptors, installWikiReferenceApi, readNativeCatalogPage } from "../src/RulesWiki.Web/wwwroot/rules-reference-api.js";
import { createRulesetReader } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { discoverAuthorizedRuleset, referenceKey, ruleRoute } from "../src/RulesWiki.Web/wwwroot/rules-context.js";

const fixture = name => JSON.parse(readFileSync(new URL("./fixtures/multi-system/" + name, import.meta.url), "utf8"));
const manifest = fixture("manifest.json");
const catalogs = new Map();
for (const entry of manifest.fixtures) {
    const definition = fixture(entry.file);
    // Fixture records retain their original wrappers. The API's native
    // category is normally the stable ID prefix for these selected records.
    const kind = entry.nativeEntityId.split(".")[0];
    const record = { id: entry.nativeEntityId, name: definition.name ?? definition.definition?.name ?? entry.nativeEntityId,
        kind, definition };
    const records = catalogs.get(entry.rulesetId) ?? [];
    records.push(record);
    catalogs.set(entry.rulesetId, records);
}
assert.equal(catalogs.size, 4);
const calls = [];
const fingerprints = new Map([...catalogs.keys()].map((id, i) => [id, "fixture-" + i]));
const allowed = new Set(catalogs.keys());
const api = installWikiReferenceApi({
    async operation(name, args = []) {
        calls.push([name, ...args]);
        if (name === "getNativeRulesets") return { rulesets: [...catalogs.keys()].map(id => ({
            id, fingerprint: fingerprints.get(id), capabilities: { read: allowed.has(id), write: false }
        })) };
        const [id, filters] = args;
        if (!allowed.has(id)) throw Error("catalog denied");
        const records = catalogs.get(id);
        const fingerprint = fingerprints.get(id);
        if (name === "getNativeRule") return { rulesetId: id, fingerprint,
            rule: records.find(r => r.id === filters) };
        assert.equal(name, "searchNativeRules");
        const matching = records.filter(r => (!filters.category || filters.category.toLowerCase() === r.kind.toLowerCase()) &&
            (!filters.q || (r.id + " " + r.name).toLowerCase().includes(filters.q.toLowerCase())));
        const categories = [...new Set(records.map(r => r.kind))];
        return { rulesetId: id, fingerprint, total: matching.length,
            offset: filters.offset, limit: filters.limit,
            categoryFacets: categories.map(kind => ({ kind, count: records.filter(r => r.kind === kind).length })),
            rules: matching.slice(filters.offset, filters.offset + filters.limit).map(({id, name, kind}) => ({id, name, kind})) };
    }
});
const open = async id => {
    const {context, descriptor} = await discoverAuthorizedRuleset(api, id);
    return createRulesetReader(api, context, descriptor);
};
assert.equal(authorizedRulesetDescriptors(await api.getNativeRulesets()).length, 4);
const warlocks = new Set();
for (const id of catalogs.keys()) {
    const reader = await open(id);
    const before = calls.length;
    const page = await api.getGlobalRulesCatalog({ limit: 1, offset: 0 }, reader);
    assert.equal(calls.length - before, 1, "all-category reads make one private operation");
    assert.equal(page.rules.length, 1);
    assert.equal(page.totalCount, catalogs.get(id).length);
    const row = page.rules[0];
    assert.equal(row.qualifiedIdentity, referenceKey(id, row.nativeId));
    assert.equal(row.browserLink.toolRelativePath, ruleRoute(id, row.nativeId));
    assert.equal((await reader.resolve(row.nativeId)).rulesetId, id);
    const next = await readNativeCatalogPage(reader, { limit: 1, offset: 1 });
    assert.notEqual(next.rules[0].nativeId, row.nativeId);
    if (id !== "fate-condensed") {
        const warlock = (await readNativeCatalogPage(reader, { entityType: "class", query: "warlock", limit: 10 })).rules.find(r => r.nativeId === "class.warlock");
        assert.ok(warlock);
        warlocks.add(warlock.qualifiedIdentity);
    } else {
        const actions = await readNativeCatalogPage(reader, { entityType: "action", limit: 10 });
        assert.equal(actions.rules[0].nativeId, "action.attack");
        assert.ok(actions.entityTypeFacets.some(f => f.entityType === "section"));
    }
}
assert.equal(warlocks.size, 3);
const first = await open("first-party-001");
const before = calls.length;
const many = catalogs.get("first-party-001");
many.push(...Array.from({length: 1000}, (_, i) => ({id: "rule.scale-" + i, name: "Scale " + i, kind: "rule", definition: {}})));
const large = await readNativeCatalogPage(first, { limit: 25 });
assert.equal(large.rules.length, 25);
assert.equal(calls.length - before, 1);
assert.ok(large.totalCount > 1000);
const alias = await readNativeCatalogPage(first, { entityType: "rule", limit: 5, offset: 1 });
assert.equal(alias.rules.length, 5);
assert.equal(alias.totalCount, many.filter(r => r.kind === "rule").length);
await assert.rejects(readNativeCatalogPage(first, { limit: 101 }), /Invalid native browser page/);
await assert.rejects(readNativeCatalogPage(first, { fieldFilters: {level: "1"} }), /does not support/);
fingerprints.set("first-party-001", "changed");
await assert.rejects(readNativeCatalogPage(first, {limit: 1}), /snapshot/);
allowed.delete("dnd-5e");
assert.equal(authorizedRulesetDescriptors(await api.getNativeRulesets()).some(d => d.id === "dnd-5e"), false);
await assert.rejects(open("dnd-5e"), /unavailable|unauthorized/);
console.log("Native browser bounded pagination, four fixture catalogs, qualified identities, stale and denied contexts passed.");
