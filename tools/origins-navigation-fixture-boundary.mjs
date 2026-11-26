// Shared local-only fixture transport for Workstream B tests and browser preview.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
export function createOriginsFixtureBoundary() {
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const manifest = read("./fixtures/origin-reference/manifest.json");
const captures = Object.assign({}, ...["responses.json.gz", "hierarchies.json.gz", "construct-characteristic-hierarchies.json.gz"].map(name =>
    JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/origin-reference/" + name, import.meta.url))).toString("utf8"))));
const first = new Map();
for (const response of Object.values(captures)) {
    for (const row of response.rows ?? []) first.set(row.id, { id: row.id, name: row.name, kind: row.kind });
}
for (const response of Object.values(captures)) {
    for (const row of response.lineage ?? []) first.set(row.id, { id: row.id, name: row.name, kind: row.kind, definition: row.definition });
}
for (const name of ["creature-origination", "species-subspecies-upbringing"]) {
    const definition = read("./fixtures/origin-navigation/" + name + ".json");
    first.set(definition.id, { id: definition.id, name: definition.name, kind: definition.kind, definition });
}
// Synthetic catalog facet for the Characters ribbon ordering only; never a
// native rule or an assertion about the captured Core catalog.
first.set("class.synthetic-navigation-test", { id: "class.synthetic-navigation-test", name: "Synthetic navigation test", kind: "class" });
const catalogs = new Map([[manifest.rulesetId, [...first.values()]]]);
for (const fixture of read("./fixtures/multi-system/manifest.json").fixtures) {
    if (fixture.rulesetId === manifest.rulesetId) continue;
    const definition = read("./fixtures/multi-system/" + fixture.file);
    const rows = catalogs.get(fixture.rulesetId) ?? [];
    rows.push({ id: fixture.nativeEntityId, name: definition.name, kind: definition.kind, definition });
    catalogs.set(fixture.rulesetId, rows);
}
const race = read("./fixtures/browser/dnd-5e--race.human.json");
catalogs.get("dnd-5e").push({ id: race.id, name: race.name, kind: race.kind, definition: race });
const fingerprints = new Map([...catalogs.keys()].map((id, i) => [id, id === manifest.rulesetId ? manifest.fingerprint : String(i+1).repeat(64)]));
const allowed = new Set(catalogs.keys());
const base = "/tools/rules-wiki";
const calls = [];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {"Content-Type": "application/json"} });
const handle = async (url, options = {}, toolRoute = "/") => {
    if (url === "/context") return reply({ apiBaseUrl: "/host/api", toolBasePath: base, toolRoute, siteMode: "dorks-and-dice" });
    if (url === "/host/api/session") return reply({ user: { displayName: "Tester" }, globalRoles: ["Owner"] });
    const op = String(url).split("/").at(-1);
    const args = JSON.parse(options.body).arguments;
    calls.push([op, ...args]);
    if (op === "getNativeRulesets") return reply({ rulesets: [...allowed].map(id => ({
        id, fingerprint: fingerprints.get(id), entityCount: catalogs.get(id).length,
        capabilities: { read: true, write: false, ...(id === manifest.rulesetId ? { originReferenceContractVersion: 1 } : {}) }
    })) });
    const [id, parameter, target] = args;
    if (!allowed.has(id)) return reply({ error: "denied" }, 403);
    const rows = catalogs.get(id);
    const fingerprint = fingerprints.get(id);
    if (op === "getNativeOriginHierarchy" || op === "getNativeOriginMethods") {
        assert.equal(id, manifest.rulesetId);
        assert.equal(parameter, manifest.fingerprint);
        const key = (op === "getNativeOriginHierarchy" ? "hierarchy-" : "methods-") + target + ".json";
        assert.ok(captures[key], key);
        return reply(captures[key]);
    }
    if (op === "getNativeRule") {
        const rule = rows.find(row => row.id === parameter && row.definition);
        return rule ? reply({ rulesetId: id, fingerprint, rule }) : reply({ error: "not found" }, 404);
    }
    assert.equal(op, "searchNativeRules");
    const filters = parameter;
    assert.ok(filters.limit <= 100);
    const matched = rows.filter(r => (!filters.category || r.kind === filters.category) &&
        (!filters.q || (r.id + " " + r.name).toLowerCase().includes(filters.q.toLowerCase())));
    matched.sort((a,b) => a.id.localeCompare(b.id));
    return reply({ rulesetId: id, fingerprint, total: matched.length, offset: filters.offset, limit: filters.limit,
        categoryFacets: [...new Set(rows.map(r => r.kind))].map(kind => ({ kind, count: rows.filter(r => r.kind === kind).length })),
        rules: matched.slice(filters.offset, filters.offset + filters.limit).map(({id,name,kind}) => ({id,name,kind})) });
};
    return { manifest, catalogs, allowed, calls, handle };
}
