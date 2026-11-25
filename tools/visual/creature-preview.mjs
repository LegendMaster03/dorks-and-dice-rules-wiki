// Local HTTP fixture preview. No live data or deployment.
import { renderNativeMonster } from "../../src/RulesWiki.Web/wwwroot/native-monster-detail.js";
import { renderNativeDetail } from "../../src/RulesWiki.Web/wwwroot/native-rule-detail.js";
import { renderStructuredContent } from "../../src/RulesWiki.Web/wwwroot/native-presentation.js";
const load = async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Fixture unavailable: " + path);
    return response.json();
};
const base = "../fixtures/multi-system/";
const fixtures = await load(base + "creature-workstream-c.json");
for (const id of ["monster.goblin-warrior", "monster.tarrasque"]) {
    fixtures.push({ rulesetId: "first-party-001", record: await load(base + "first-party-001--" + id + ".json") });
}
fixtures.push({ rulesetId: "synthetic", record: await load(base + "synthetic/kaiju-reference-fixture.json") });
const select = document.querySelector("#fixture");
const panel = document.querySelector("#preview");
const width = document.querySelector("#width");
for (const [index, item] of fixtures.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = item.rulesetId + " — " + (item.record.name ?? "Kaiju Reference Fixture");
    select.append(option);
}
function show() {
    const { rulesetId, record } = fixtures[Number(select.value)];
    panel.style.width = width.value;
    if (rulesetId === "synthetic") {
        panel.replaceChildren(renderNativeMonster({ name: record.name ?? "Kaiju Reference Fixture", definition: record }, renderStructuredContent));
    } else {
        const context = { rulesetId, fingerprint: "fixture-only", campaignId: null, campaignRevisionId: null };
        renderNativeDetail(panel, { rulesetId, fingerprint: "fixture-only",
            rule: { id: record.id, name: record.name, kind: record.kind, definition: record } }, () => {}, null,
            { reader: { context, packageDescriptor: null } });
    }
}
select.addEventListener("change", show);
width.addEventListener("change", show);
show();
