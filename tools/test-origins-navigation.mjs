// Workstream B: actual captured Core projections and isolated workspace composition.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { JSDOM } from "jsdom";
import { createRulesContext, ruleRoute } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createRulesetReader } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { parseToolRoute } from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";
import { ORIGIN_GROUPS, CONSTRUCT_SECTIONS, originRoute, originWorkspaceForRule, originsEnabled, originMenu, renderOriginsWorkspace, cancelOriginsWorkspace } from "../src/RulesWiki.Web/wwwroot/origins-navigation.js";

const dom = new JSDOM('<main id="root"></main>', { url: "https://site.test/tools/rules-wiki/", pretendToBeVisual: true });
for (const name of ["window", "document", "Node", "Element", "HTMLElement", "Event", "KeyboardEvent", "NodeFilter"]) globalThis[name] = dom.window[name];
const root = document.getElementById("root");
const fixture = new URL("./fixtures/origin-reference/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", fixture), "utf8"));
const captures = Object.assign({}, ...["responses.json.gz", "hierarchies.json.gz", "construct-characteristic-hierarchies.json.gz"].map(name =>
    JSON.parse(gunzipSync(readFileSync(new URL(name, fixture))).toString("utf8"))));
const context = createRulesContext({ rulesetId: manifest.rulesetId, fingerprint: manifest.fingerprint });
const descriptor = { id: context.rulesetId, fingerprint: context.fingerprint, capabilities: { read: true, originReferenceContractVersion: 1 } };
let calls = [];
const captured = prefix => async (rulesetId, fingerprint, target) => {
    assert.equal(rulesetId, context.rulesetId);
    assert.equal(fingerprint, context.fingerprint);
    calls.push(prefix + target);
    const response = captures[prefix + target + ".json"];
    assert.ok(response, "Missing captured response " + target);
    return structuredClone(response);
};
const reader = createRulesetReader({ getNativeOriginHierarchy: captured("hierarchy-"), getNativeOriginMethods: captured("methods-") }, context, descriptor);
const app = { rulesetReader: reader, rulesContext: reader.context, hostContext: { toolBasePath: "/tools/rules-wiki" }, render() {} };
for (const [, title] of ORIGIN_GROUPS.flatMap(g => g.views)) assert.ok(title);
for (const [view] of ORIGIN_GROUPS.flatMap(g => g.views)) assert.equal(parseToolRoute(originRoute(view)).originsView, view);
for (const [section] of CONSTRUCT_SECTIONS) assert.equal(parseToolRoute(originRoute("construct-assembly", section)).originsSection, section);
assert.equal(parseToolRoute("/rulesets/dnd-5e/origins/overview").unsupportedRulesContext, true);
assert.equal(parseToolRoute("/rulesets/first-party-001/origins/missing").unsupportedRulesContext, true);
assert.equal(parseToolRoute("/rulesets/first-party-001/types/ancestry").entityType, "ancestry");
assert.equal(parseToolRoute("/rulesets/dnd-5e/types/subrace").entityType, "subrace");
assert.equal(parseToolRoute("/rulesets/dnd-5-5e/types/species").entityType, "species");
assert.equal(parseToolRoute("/rulesets/fate-condensed/types/skill").entityType, "skill");
assert.equal(parseToolRoute("/subspecies").entityType, "ancestry");
assert.equal(parseToolRoute("/subspecies/wood-elf").conceptKey, "subspecies.wood-elf");
assert.equal(parseToolRoute(ruleRoute(context.rulesetId, "ancestry.dragonborn.red")).conceptKey, "ancestry.dragonborn.red");
assert.deepEqual(originWorkspaceForRule({ kind: "ancestry", id: "ancestry.dragonborn.red" }), ["species-and-ancestries", null]);
assert.deepEqual(originWorkspaceForRule({ kind: "construct-material" }), ["construct-assembly", "materials"]);
assert.equal(originWorkspaceForRule({ kind: "race" }), null);
let selected;
app.navigateOrigins = view => { selected = view; };
root.append(originMenu(app, "methods"));
assert.equal(root.querySelectorAll("button").length, 9);
assert.equal(root.querySelector('[aria-current="page"]').textContent, "Origination Methods");
root.querySelector("button").click();
assert.equal(selected, "overview");

async function open(view, section = null) {
    calls = [];
    await renderOriginsWorkspace(app, root, parseToolRoute(originRoute(view, section)));
    assert.ok(root.querySelector(".wiki-origins"), root.textContent);
}
await open("species-and-ancestries");
assert.deepEqual(calls, ["hierarchy-biological"]);
assert.equal(root.querySelectorAll(".wiki-origins-records li").length, 43);
assert.ok(root.querySelector('a[href$="/rules/ancestry.dragonborn.red"]'));
await open("characteristics");
assert.deepEqual(calls, ["hierarchy-characteristics"]);
assert.equal(root.querySelectorAll(".wiki-origins-records li").length, 105);
await open("construct-assembly", "recipes");
assert.deepEqual(calls, ["hierarchy-construct-options"]);
assert.equal(root.querySelectorAll(".wiki-origins-records li").length, 90);
assert.equal(root.querySelectorAll(".wiki-origins-sections[aria-label='Construct Assembly sections'] a").length, 6);
await open("upbringings");
assert.deepEqual(calls, ["hierarchy-upbringing"]);
await open("backgrounds");
assert.deepEqual(calls, ["hierarchy-backgrounds"]);
await open("methods");
assert.deepEqual(calls, ["methods-all"]);
assert.match(root.textContent, /Authored default availability/);
await open("inheritance-and-transformation");
assert.deepEqual(calls, ["methods-all"]);
assert.match(root.textContent, /changing an existing individual/);

// Synthetic composition seam: no other workstream is required to run this test.
app.originWorkspaceRenderers = { characteristics: async input => {
    assert.equal(input.reader, reader);
    assert.equal(input.lifecycle.isCurrent(), true);
    const section = document.createElement("section");
    section.textContent = "Specialized reader";
    return section;
} };
await open("characteristics");
assert.match(root.textContent, /Specialized reader/);
assert.deepEqual(calls, []);
let release;
app.originWorkspaceRenderers.characteristics = () => new Promise(resolve => { release = resolve; });
const pending = renderOriginsWorkspace(app, root, parseToolRoute(originRoute("characteristics")));
cancelOriginsWorkspace(app);
root.textContent = "New route";
release(document.createElement("section"));
await pending;
assert.equal(root.textContent, "New route");

for (const scenario of ["denied", "stale"]) {
    const failedReader = createRulesetReader({ getNativeOriginHierarchy: async () => {
        if (scenario === "denied") throw new Error("denied");
        return { ...captures["hierarchy-biological.json"], fingerprint: "stale" };
    } }, context, descriptor);
    app.rulesetReader = failedReader; app.rulesContext = failedReader.context;
    await renderOriginsWorkspace(app, root, parseToolRoute(originRoute("species-and-ancestries")));
    assert.match(root.textContent, /Origins reference unavailable/);
    assert.equal(root.querySelectorAll(".wiki-origins-records a").length, 0);
}
const foreignContext = createRulesContext({ rulesetId: "dnd-5e", fingerprint: context.fingerprint });
const foreign = createRulesetReader({}, foreignContext, { ...descriptor, id: foreignContext.rulesetId });
assert.equal(originsEnabled(foreign), false);
app.rulesetReader = foreign; app.rulesContext = foreign.context;
await renderOriginsWorkspace(app, root, parseToolRoute(originRoute("overview")));
assert.match(root.textContent, /Character Origins unavailable/);
console.log("Origins navigation and captured Core workspace reference tests passed.");
