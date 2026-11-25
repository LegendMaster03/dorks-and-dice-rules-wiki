/** Workstream E focused acceptance using authored records, not invented rules. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createRulesContext } from "../src/RulesWiki.Web/wwwroot/rules-context.js";
import { createNativeRendererRegistry, createPresentationInput, createRulesetReader } from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { registerNativeRenderers } from "../src/RulesWiki.Web/wwwroot/native-renderers-reference.js";
import { createWikiNativeRendererRegistry, renderNativeDetail } from "../src/RulesWiki.Web/wwwroot/native-rule-detail.js";

const dom = new JSDOM("<main></main>", { url: "https://wiki.example.test/tools/rules-wiki/" });
for (const key of ["window", "document", "Node", "NodeFilter", "Element", "HTMLElement", "Event"]) globalThis[key] = dom.window[key];
const main = document.querySelector("main");
const registry = createWikiNativeRendererRegistry();
const referenceRegistry = createNativeRendererRegistry();
registerNativeRenderers(referenceRegistry);
const records = new Map();
const identity = (system, id) => JSON.stringify([system, id]);
for (const directory of ["multi-system", "native-entities"]) {
    const base = new URL("./fixtures/" + directory + "/", import.meta.url);
    const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", base), "utf8"));
    for (const fixture of manifest.fixtures) {
        const r = JSON.parse(fs.readFileSync(new URL(fixture.file, base), "utf8"));
        assert.equal(r.id, fixture.nativeEntityId);
        assert.equal(fixture.sourceRevision, manifest.sourceRevision);
        assert.ok(fixture.sourceFile.startsWith("data/rulesets/" + fixture.rulesetId + "/native/"));
        records.set(identity(fixture.rulesetId, r.id), r);
    }
}
const first = "first-party-001", old = "dnd-5e", modern = "dnd-5-5e", fate = "fate-condensed";
const previewArg = process.argv.indexOf("--preview-dir");
const previewDir = previewArg >= 0 ? process.argv[previewArg + 1] : null;
if (previewArg >= 0 && !previewDir) throw Error("--preview-dir requires a directory");
if (previewDir) fs.mkdirSync(previewDir, { recursive: true });

function makeInput(system, record, withReader = true, kind = record.kind) {
    const context = createRulesContext({ rulesetId: system, fingerprint: "synthetic-entity-fixture" });
    const envelope = { rulesetId: system, fingerprint: context.fingerprint,
        rule: { id: record.id, name: record.name, kind, definition: record } };
    const reader = withReader ? createRulesetReader({
        // Presentation must not initiate unsanctioned lookups or mechanics.
        getNativeRule: async () => { throw Error("Unexpected entity fetch"); },
        searchNativeRules: async () => { throw Error("Unexpected catalog search"); }
    }, context) : null;
    return { input: createPresentationInput(context, envelope, reader), envelope, reader };
}
function fixture(system, id) {
    const record = records.get(identity(system, id));
    assert.ok(record, "Missing pinned fixture " + system + " " + id);
    return record;
}
function summary(root, label) {
    const stat = [...root.querySelectorAll(".rules-core-compact-stat")]
        .find(n => n.querySelector(".rules-core-compact-stat-label")?.textContent === label);
    return stat?.querySelector(".rules-core-compact-stat-value")?.textContent ?? null;
}
function scopedLink(root, system, id) {
    return [...root.querySelectorAll("a[href]")].some(n => n.getAttribute("href") ===
        "/rulesets/" + system + "/rules/" + id);
}
function writePreview(system, record, mounted) {
    if (!previewDir) return;
    const page = new JSDOM("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head><body><main class='container rules-core-library-detail'></main></body></html>");
    const doc = page.window.document;
    doc.title = system + " — " + record.name;
    for (const name of ["rules-core.css", "rules-core-detail.css", "condition-detail.css"]) {
        const stylesheet = doc.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = pathToFileURL(fileURLToPath(new URL("../src/RulesWiki.Web/wwwroot/" + name, import.meta.url))).href;
        doc.head.append(stylesheet);
    }
    doc.querySelector("main").append(...[...mounted.childNodes].map(n => doc.importNode(n, true)));
    fs.writeFileSync(path.join(previewDir, system + "--" + record.id + ".html"), page.serialize());
}
let count = 0;
function show(system, id, expected) {
    const record = fixture(system, id), { input, envelope, reader } = makeInput(system, record);
    const before = JSON.stringify(record);
    assert.equal(registry.select(input).id, expected, system + " " + id);
    assert.equal(renderNativeDetail(main, envelope, () => {}, null, { reader }), true);
    assert.equal(main.querySelectorAll(".ruleset-package-attribution").length, 1, system + " " + id);
    assert.equal(JSON.stringify(record), before, "Native input was mutated");
    assert.equal(main.querySelector("script, img[onerror], [onclick]"), null);
    assert.ok(main.textContent.includes(record.name));
    count++;
    const view = main.cloneNode(true);
    writePreview(system, record, view);
    return view;
}
const spell51 = show(old, "spell.acid-splash", "reference.spell");
const spell52 = show(modern, "spell.acid-splash", "reference.spell");
assert.equal(summary(spell51, "Level"), "Cantrip");
assert.equal(summary(spell51, "School"), "Conjuration");
assert.equal(summary(spell52, "School"), "Evocation");
assert.equal(summary(spell51, "Casting Time"), "1 action");
assert.equal(summary(spell52, "Casting Time"), "Action");
assert.ok(scopedLink(spell51, old, "rulebook.page-114"));
assert.ok(scopedLink(spell52, modern, "rulebook.page-107"));
assert.ok(!scopedLink(spell52, old, "rulebook.page-114"));
assert.ok(spell52.querySelector("details pre")?.textContent.includes("Cantrip Upgrade"));
assert.match(spell52.textContent, /Higher-level effects/);

const backpack = show(old, "item.backpack", "reference.equipment");
assert.equal(summary(backpack, "Weight"), "5 lb.");
assert.equal(summary(backpack, "Value"), "2 gp");
assert.match(backpack.textContent, /Container Capacity/i);
const javelin = show(modern, "item.javelin-of-lightning", "reference.equipment");
assert.equal(summary(javelin, "Weapon Mastery"), "Slow");
assert.equal(summary(javelin, "Weapon properties"), "Thrown");
assert.ok(scopedLink(javelin, modern, "item-mastery.slow"));
const plate = show(modern, "baseitem.plate-armor", "reference.equipment");
assert.equal(summary(plate, "Reference type"), "Base item");
assert.equal(summary(plate, "Armor Class"), "18");
const group = show(modern, "item-group.arcane-focus", "reference.equipment");
assert.equal(summary(group, "Reference type"), "Item group");
assert.equal(summary(group, "Armor Class"), null);
assert.equal(summary(group, "Value"), null);
const template = show(modern, "magic-variant.1-ammunition", "reference.equipment");
assert.equal(summary(template, "Reference type"), "Magic item template");
assert.equal(summary(template, "Damage"), null);
assert.match(template.textContent, /Template inheritance/);
for (const id of ["item.1-arrow", "item.adamantine-breastplate"]) {
    const view = show(modern, id, "reference.equipment"), r = fixture(modern, id);
    assert.equal(summary(view, "Reference type"), "Derived item");
    assert.ok(scopedLink(view, modern, r.baseItemId));
    assert.ok(scopedLink(view, modern, r.variantOf));
}
const qualification = show(first, "equipment.weapon.club", "reference.native-equipment");
assert.equal(summary(qualification, "Equipment category"), "weapon");
assert.equal(summary(qualification, "Damage"), null);
assert.ok(scopedLink(qualification, first, "equipment.group.weapon.simple"));
show(first, "equipment.group.weapon.all", "reference.native-equipment");

const human = show(modern, "species.human", "reference.imported-origin");
assert.match(human.textContent, /Skillful/);
assert.match(human.textContent, /Skill proficiencies/);
const humanNative = show(first, "species.human", "reference.native-origin");
assert.ok(scopedLink(humanNative, first, "trait.skillful"));
assert.equal(summary(humanNative, "Walking speed"), "30 ft.");
assert.doesNotMatch(humanNative.textContent, /Origin typeRace/);
show(old, "race.dragonborn", "reference.imported-origin");
show(old, "subrace.dwarf.hill", "reference.imported-origin");
const acolyte = show(modern, "background.acolyte", "reference.imported-origin");
assert.match(acolyte.textContent, /Starting equipment/);
assert.match(acolyte.textContent, /weighted/i);
const nativeAcolyte = show(first, "background.acolyte", "reference.native-origin");
assert.match(nativeAcolyte.textContent, /Insight Training/);
assert.ok(scopedLink(nativeAcolyte, first, "skill.insight"));
const drow = show(first, "ancestry.elf.drow", "reference.native-origin");
assert.ok(scopedLink(drow, first, "species.elf"));
assert.ok(scopedLink(drow, first, "upbringing.elf.drow"));
show(first, "trait.skillful", "reference.native-origin");
show(first, "upbringing.aristocratic", "reference.native-origin");
show(first, "construct-design.reinforced-frame", "reference.native-origin");
const originRules = show(first, "rule.species-subspecies-upbringing", "reference.origin-rule");
assert.match(originRules.textContent, /Origin Inheritance/);
assert.match(originRules.textContent, /Upbringings/);
const origination = show(first, "rule.creature-origination", "reference.origin-rule");
assert.match(origination.textContent, /Biological reproduction/);
assert.match(origination.textContent, /Construct assembly/);
assert.match(origination.textContent, /Elemental manifestation/);

const exhaust51 = show(old, "condition.exhaustion", "reference.condition");
const exhaust52 = show(modern, "condition.exhaustion", "reference.condition");
assert.equal(summary(exhaust51, "Levels"), "6");
assert.equal(summary(exhaust52, "Levels"), "6");
assert.match(exhaust51.textContent, /Disadvantage on ability checks/i);
assert.match(exhaust52.textContent, /D20 Tests/i);
assert.match(exhaust52.textContent, /5 feet/i);
assert.doesNotMatch(exhaust52.textContent, /Disadvantage on ability checks/i);
assert.ok(exhaust51.querySelector("table"));
const nativeExhaustion = show(first, "condition.exhaustion", "legacy-first-party");
assert.ok(nativeExhaustion.querySelector(".rules-wiki-condition-article"));

const athletics = show(fate, "skill.athletics", "reference.skill");
assert.equal(summary(athletics, "Default rating"), "+0");
assert.equal(summary(athletics, "Ability"), null);
assert.equal(summary(athletics, "Proficiency bonus"), null);
const dndAthletics = show(old, "skill.athletics", "reference.skill");
assert.equal(summary(dndAthletics, "Ability"), "Strength");
const nativeAthletics = show(first, "skill.athletics", "reference.skill");
assert.ok(scopedLink(nativeAthletics, first, "skill.climb"));
assert.ok(scopedLink(nativeAthletics, first, "skill.swim"));
assert.match(nativeAthletics.textContent, /arithmetic-mean/);
show(first, "skill.perform", "reference.skill");
const perform = show(first, "skill.perform-act", "reference.skill");
assert.ok(scopedLink(perform, first, "skill.perform"));
show(first, "competency.smithing", "reference.skill");
const competencyCategory = show(first, "competency-category.crafting-method", "reference.skill");
assert.ok(scopedLink(competencyCategory, first, "competency.smithing"));

const feat = show(modern, "feat.ability-score-improvement", "reference.feat");
assert.equal(summary(feat, "Repeatable"), "Yes");
assert.match(feat.textContent, /Prerequisites/);
// The integrated registry gives class-specific options to D, ahead of E’s generic text fallback.
const invocation = makeInput(modern, fixture(modern, "optional-feature.agonizing-blast")).input;
assert.equal(referenceRegistry.select(invocation).id, "reference.text");
show(modern, "optional-feature.agonizing-blast", "class.imported-option");
show(modern, "trap.collapsing-roof", "reference.text");
show(modern, "glossary.ability-check", "reference.text");
show(old, "language.abyssal", "reference.text");
show(old, "sense.blindsight", "reference.text");
show(old, "rulebook.page-003", "reference.text");

const chapter = show(fate, "section.taking-action-rolling-the-dice", "reference.text");
const nested = show(fate, "section.getting-started.create-your-characters.skills.the-adjective-ladder", "reference.text");
assert.ok(scopedLink(nested, fate, "section.getting-started.create-your-characters.skills"));
const action = show(fate, "action.attack", "reference.text");
assert.match(action.textContent, /Attack to harm the enemy/);
const ladder = show(fate, "rule.adjective-ladder", "reference.fate-ratings");
assert.match(ladder.querySelector("table").textContent, /\+8Legendary/);
assert.match(ladder.querySelector("table").textContent, /-4Horrifying/);
const pyramid = show(fate, "rule.starting-skill-pyramid", "reference.fate-ratings");
assert.equal(summary(pyramid, "Remaining rating"), "+0");
assert.ok(pyramid.querySelector("table"));
const stress = show(fate, "rule.stress-capacity", "reference.fate-ratings");
assert.equal(summary(stress, "Box value"), "1");
assert.ok(scopedLink(stress, fate, "skill.physique"));
assert.ok(stress.querySelector("table"));
const advancement = show(old, "table.character-advancement", "reference.table");
assert.equal(advancement.querySelectorAll("tbody tr").length, 20);
assert.match(advancement.querySelector("table").textContent, /355,00020\+6/);

assert.ok(chapter.querySelector(".rules-core-markdown h3"));
assert.ok(nested.querySelector(".rules-core-markdown table"));
assert.ok(action.querySelector(".rules-core-markdown ul"));
assert.doesNotMatch(acolyte.querySelector(".native-reference-article").textContent, /\{@(?:feat|skill|item) /);

// Synthetic presentation edge cases, never presented as authored Core content.
const sparse = { id: "spell.sparse-fixture", name: "Sparse fixture", kind: "spell", school: "V" };
const sparseInput = makeInput(old, sparse).input;
const sparseView = registry.render(sparseInput);
const compatible = makeInput("compatible-fixture", sparse).input;
assert.equal(registry.select(compatible).id, "reference.spell");
assert.equal(summary(sparseView, "Level"), null);
assert.equal(summary(sparseView, "Duration"), null);
assert.equal(summary(sparseView, "School"), "Evocation");
const injected = { id: "item.presentation-fixture", name: "Presentation fixture", kind: "item", type: "G",
    entries: ["<img src=x onerror=alert(1)>", { type: "table", colLabels: ["Name"], rows: [["Nested"]] }],
    catalogReferences: ["skill.athletics", "javascript:alert(1)"],
    arbitrary: { rulesetId: modern, ruleId: "item.foreign-fixture" } };
const injectedInput = makeInput(old, injected).input;
const safe = registry.render(injectedInput);
assert.equal(safe.querySelector("img, script, [onerror]"), null);
assert.ok(safe.querySelector("table"));
assert.match(safe.textContent, /<img/);
assert.ok(scopedLink(safe, old, "skill.athletics"));
assert.ok(!scopedLink(safe, old, "item.foreign-fixture"));
assert.ok(![...safe.querySelectorAll("a")].some(a => a.getAttribute("href").startsWith("javascript:")));
const unbound = registry.render(makeInput(old, injected, false).input);
assert.equal(unbound.querySelector(".native-reference-links a"), null);
const unknown = { id: "unrecognized.fixture", name: "Unknown", kind: "unrecognized", data: { detail: "Kept" } };
const unknownInput = makeInput(modern, unknown).input;
assert.equal(registry.select(unknownInput).id, "generic");
assert.match(registry.render(unknownInput).textContent, /Kept/);
const mismatched = makeInput(old, { ...sparse, kind: "skill" }, true, "spell").input;
assert.equal(registry.select(mismatched).id, "generic");
console.log("Native entity renderer checks passed (" + count + " actual fixture presentations; synthetic edge cases separate).");
