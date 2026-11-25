// Checks native monster and Kaiju statblock presentation contracts.
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderNativeMonster, renderMonsterDice } from "../src/RulesWiki.Web/wwwroot/native-monster-detail.js";
import * as sharedPresentation from "../src/RulesWiki.Web/wwwroot/native-presentation.js";
import { supportsImportedCreature, renderImportedCreature } from "../src/RulesWiki.Web/wwwroot/native-renderers-creature.js";
import { renderNativeDetail } from "../src/RulesWiki.Web/wwwroot/native-rule-detail.js";

// Local DOM substitute used for renderer regression checks without a browser.
class FakeNode {
    constructor(tag = "#text") {
        this.tagName = tag.toUpperCase();
        this.childNodes = [];
        this._text = "";
        this.attrs = {};
        this.dataset = {};
        this.events = {};
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            remove: (...names) => names.forEach(name => this._classes.delete(name)),
            contains: name => this._classes.has(name)
        };
    }
    set className(text) { this._classes = new Set(text.split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(" "); }
    set textContent(value) { this._text = String(value); this.childNodes = []; }
    get textContent() { return this._text + this.childNodes.map(node => node.textContent).join(""); }
    get children() { return this.childNodes.filter(node => node instanceof FakeNode && node.tagName !== "#TEXT"); }
    append(...nodes) {
        for (const node of nodes.flat(Infinity)) {
            if (node === null || node === undefined || node === false) continue;
            const child = node instanceof FakeNode ? node : new FakeText(String(node));
            child.parentNode = this;
            this.childNodes.push(child);
        }
    }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    replaceChildren(...nodes) { this._text = ""; this.childNodes = []; this.append(...nodes); }
    addEventListener(name, action) { this.events[name] = action; }
    closest(selector) { return this.className.split(/\s+/).includes(selector.slice(1)) ? this : this.parentNode?.closest(selector) ?? null; }
    querySelector(selector) { return all(this, node => node.className.split(/\s+/).includes(selector.slice(1)))[0] ?? null; }
}
class FakeText extends FakeNode { constructor(value) { super("#text"); this._text = value; } }
globalThis.Node = FakeNode;
globalThis.document = { createElement: name => new FakeNode(name), createTextNode: text => new FakeText(text) };
const all = (root, predicate) => [root, ...root.children.flatMap(node => all(node, predicate))].filter(predicate);
const cls = (root, className) => all(root, node => node.classList.contains(className));
const show = definition => renderNativeMonster({ name: definition.name ?? "Test Creature", definition },
    value => { const node = new FakeNode("span"); node.textContent = typeof value === "string" ? value : JSON.stringify(value); return node; });

const wolf = show({ name: "Wolf", size: ["M"], type: "beast", alignment: ["U"], ac: [12],
    hp: { average: 11, formula: "2d8 + 2" }, speed: { walk: 40 }, str: 14, dex: 15,
    con: 12, int: 3, wis: 12, cha: 6, cr: "1/4",
    save: { wis: "+3" }, trait: [{ name: "Pack Tactics", entries: ["Attack rolls have Advantage."] }],
    action: [{ name: "Bite", entries: ["{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) Piercing damage."] }]
});
assert.match(wolf.textContent, /Wolf/);
assert.match(wolf.textContent, /Medium · Beast · Unaligned/);
assert.match(wolf.textContent, /CR 1\/4/);
assert.match(wolf.textContent, /11 \(2d8 \+ 2\)/);
assert.equal(cls(wolf, "rw-stat-ability").length, 6);
assert.match(wolf.textContent, /Save \+3/);
assert.match(wolf.textContent, /Pack Tactics/);
assert.match(wolf.textContent, /Bite/);
assert.ok(cls(wolf, "rw-stat-roll").length >= 2);
const roll = cls(wolf, "rw-stat-roll")[0];
assert.equal(typeof roll.events.click, "function");
roll.events.click();
assert.match(cls(wolf, "rw-stat-roll-result")[0].textContent, /1d20\+4: \d+/);
assert.equal(cls(wolf, "rw-stat-section").some(node => node.textContent.startsWith("Lair Actions")), false);

const lich = show({ name: "Lich", size: ["M"], type: { type: "undead", tags: ["wizard"] },
    alignment: ["N", "E"], ac: [20], hp: { average: 315, formula: "42d8 + 126" },
    speed: { walk: 30 }, str: 11, dex: 16, con: 16, int: 21, wis: 14, cha: 16,
    save: { dex: "+10", int: "+12" }, cr: { cr: "21", xpLair: 41000 },
    trait: [{ name: "Turn Resistance", entries: ["Resists turning."] }],
    action: [{ name: "Eldritch Burst", entries: ["{@atkr m,r} {@hit 12}, {@h}31 ({@damage 4d12 + 5}) Force damage."] }],
    legendaryActionsLair: 4,
    legendary: [{ name: "Disrupt Life", entries: ["{@actSave con} {@dc 20} or {@actSaveFail} damage."] }],
    spellcasting: [
        { name: "Spellcasting", displayAs: "action", headerEntries: ["Spell save {@dc 20}."],
            will: ["{@spell Detect Magic|SRD52}", "{@spell Fireball|SRD52}"], daily: { "2e": ["{@spell Animate Dead|SRD52}"] } },
        { name: "Protective Magic", displayAs: "reaction", headerEntries: ["Casts {@spell Shield|SRD52}."], will: ["{@spell Shield|SRD52}"], hidden: ["will"] }
    ],
    novelDefense: { attackPenalty: 2 }
});
assert.match(lich.textContent, /CR 21/);
assert.match(lich.textContent, /Legendary Actions/);
assert.match(lich.textContent, /Spellcasting/);
assert.match(lich.textContent, /Protective Magic/);
assert.equal((lich.textContent.match(/Shield/g) ?? []).length, 1, "Hidden spell lists must not duplicate text.");
assert.equal((lich.textContent.match(/Spellcasting/g) ?? []).length, 1, "Spellcasting belongs in the action section once.");
assert.match(lich.textContent, /Novel Defense/);
assert.ok(cls(lich, "rw-stat-entry").length >= 4);

// Kaiju fixture uses the reference concepts already implemented in Block
// Initiative. Values are testing data, never added to authoritative creatures.
const kaiju = show(JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/synthetic/kaiju-reference-fixture.json", import.meta.url))));
assert.equal(cls(kaiju, "rw-statblock-kaiju").length, 1);
assert.match(kaiju.textContent, /Kaiju Reference/);
assert.equal(cls(kaiju, "rw-stat-kaiju-columns").length, 1,
    "Kaiju inherits the shared statblock with a distinct two-column layout.");
assert.equal(cls(kaiju, "rw-stat-kaiju-column").length, 2);
const columns = cls(kaiju, "rw-stat-kaiju-column");
assert.match(columns[0].textContent, /Ability Scores & Saves/);
assert.match(columns[1].textContent, /Legendary Actions/);
assert.match(kaiju.textContent, /Vulnerability Identification DC18/);
assert.match(kaiju.textContent, /XP Milestones/);
assert.match(kaiju.textContent, /Chaos reduced to zero5000/);
assert.match(kaiju.textContent, /Lost While Head Exploited/);
assert.match(kaiju.textContent, /Gained Features/);
assert.match(kaiju.textContent, /Lost Features/);
assert.match(kaiju.textContent, /12.*15.*35.*18.*18.*65.*24.*21.*105/s);
assert.equal(cls(kaiju, "rw-stat-ability").length, 6);
assert.equal(cls(kaiju, "rw-stat-tile").filter(node => node.textContent.includes("Hit Points")).length, 0,
    "A Kaiju with a Chaos Threshold must not show ordinary HP as its primary pool.");
assert.match(kaiju.textContent, /Hit Points \(source\)/);
for (const label of ["Chaos Threshold150", "Finishing Blow60", "Vulnerable Areas", "Head", "Arm",
    "Targeting", "Exploitation", "Behaviours", "Escalation", "Counterattack", "Rampage",
    "Death Throes", "Death Rattle", "Legendary Actions", "Keep this detail", "preserve unexplained mechanics"]) {
    assert.ok(kaiju.textContent.includes(label), `Kaiju must include ${label}`);
}
assert.equal(cls(kaiju, "rw-stat-kaiju-area").length, 2);
assert.equal(cls(kaiju, "rw-stat-kaiju-area-variant").length, 2,
    "One area can display multiple CR/AC/HP rows without being duplicated as areas.");
assert.equal(cls(kaiju, "rw-stat-kaiju-table").length, 3,
    "Separate Vulnerable Areas, Behaviours and XP tables.");
assert.equal(cls(kaiju, "rw-stat-kaiju-behaviour").length, 2);
assert.ok(cls(kaiju, "rw-stat-roll").length);
assert.doesNotMatch(kaiju.textContent, /Additional MechanicsKaiju/,
    "Kaiju profile belongs in its own presentation section.");

// A standard boss can use only part of the Kaiju mechanics without becoming a
// Kaiju combatant and without losing its ordinary HP or shared actions.
const mixedBoss = show({ name: "Mixed Boss", blockType: "standard", ac: [17],
    hp: { average: 100, formula: "10d10 + 45" }, str: 18,
    kaiju: { chaosThreshold: 70, finishingBlow: 35,
        vulnerableAreas: [{ name: "Weak Point", hp: 15 }],
        rampage: "Encounter-specific rule" },
    action: [{ name: "Strike", entries: ["Melee attack."] }]
});
assert.equal(cls(mixedBoss, "rw-statblock-kaiju").length, 0);
assert.match(mixedBoss.textContent, /Hit Points100/);
assert.match(mixedBoss.textContent, /Kaiju Mechanics/);
assert.match(mixedBoss.textContent, /Chaos Threshold70/);
assert.match(mixedBoss.textContent, /Finishing Blow35/);
assert.match(mixedBoss.textContent, /Weak Point/);
assert.match(mixedBoss.textContent, /Strike/);

const kaijuWithoutProfile = show({ name: "Kaiju Without Reference Content", blockType: "kaiju",
    ac: [19], hp: { average: 90, formula: "10d10 + 35" } });
assert.equal(cls(kaijuWithoutProfile, "rw-stat-kaiju").length, 0,
    "Do not fabricate empty Kaiju data for a marked creature.");
assert.match(kaijuWithoutProfile.textContent, /Hit Points90/,
    "Do not suppress a source statistic unless the Kaiju pool is supplied.");

const historical = show({ name: "Historical Creature", size: "L", ac: 22, touchAc: 13,
    flatFootedAc: 19, str: 18, dex: 14, fortitude: "+9", reflex: "+5", will: "+3",
    bab: "+12", grapple: "+19", dr: "5/magic", sr: "20", reach: "10 ft.",
    specialAttacks: [{ name: "Improved Grab", entries: ["Special attack."] }],
    specialQualities: [{ name: "Fast Healing", entries: ["3 HP per turn."] }],
    futureRule: "preserve me"
});
for (const name of ["Touch AC", "Flat-Footed AC", "Fortitude", "Reflex", "Will", "Base Attack Bonus",
    "Grapple", "Damage Reduction", "Spell Resistance", "Improved Grab", "Fast Healing", "Future Rule", "preserve me"]) {
    assert.ok(historical.textContent.includes(name), `${name} must remain visible`);
}
assert.match(historical.textContent, /Save —/, "Historical saves must not be inferred from 5.x modifiers.");
const css = fs.readFileSync(new URL("../src/RulesWiki.Web/wwwroot/native-monster-detail.css", import.meta.url), "utf8");
assert.match(css, /container-type:\s*inline-size/);
assert.match(css, /@container \(max-width: 760px\)/);
assert.match(css, /@container \(max-width: 420px\)/);
assert.doesNotMatch(fs.readFileSync(new URL("../src/RulesWiki.Web/wwwroot/native-monster-detail.js", import.meta.url), "utf8"), /innerHTML/);
const integrated = new FakeNode("main");
renderNativeDetail(integrated, { rulesetId: "first-party-001", fingerprint: "test", rule: {
    id: "monster.wolf", kind: "monster", name: "Wolf", definition: { ...{ size: ["M"], ac: [12],
        str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6, action: [{ name: "Bite", entries: ["Bite attack"] }] } }
} }, () => {});
assert.equal(cls(integrated, "rw-statblock").length, 1);
assert.equal(cls(integrated, "rules-wiki-monster-article").length, 1);
assert.equal(cls(integrated, "rw-stat-ability").length, 6);
assert.match(integrated.textContent, /Bite attack/);
assert.doesNotMatch(integrated.textContent, /Undefined/);
console.log("Native monster statblock renderer checks passed.");
 // Actual source records from both editions, pinned to the Core foundation revision.
const imported = JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/creature-workstream-c.json", import.meta.url)));
const view = (rulesetId, id) => {
    const { record } = imported.find(x => x.rulesetId === rulesetId && x.record.id === id);
    const rule = { id, name: record.name, kind: record.kind, definition: record };
    assert.ok(supportsImportedCreature({ context: { rulesetId }, record, rule }));
    assert.equal(supportsImportedCreature({ context: { rulesetId: "fate-condensed" }, record, rule }), false);
    const target = new FakeNode("main");
    const snapshot = JSON.stringify(record);
    const context = { rulesetId, fingerprint: "fixture-only", campaignId: null, campaignRevisionId: null };
    renderNativeDetail(target, { rulesetId, fingerprint: "fixture-only", rule }, () => {}, null,
        { reader: { context, packageDescriptor: null } });
    assert.equal(cls(target, "rw-statblock").length, 1);
    assert.equal(JSON.stringify(record), snapshot);
    assert.doesNotMatch(target.textContent, /NaN|\[object Object\]/);
    return target;
};
const oldWerewolf = view("dnd-5e", "monster.werewolf");
assert.match(oldWerewolf.textContent, /11 \(in humanoid form\), 12 \(natural armor; in wolf or hybrid form\)/);
assert.match(oldWerewolf.textContent, /30 ft\. \(40 ft\. in wolf form\)/);
assert.match(oldWerewolf.textContent, /from nonmagical attacks that aren't silvered/);
const newWerewolf = view("dnd-5-5e", "monster.werewolf");
assert.match(newWerewolf.textContent, /71 \(11d8 \+ 22\)/);
assert.doesNotMatch(newWerewolf.textContent, /11 \(in humanoid form\)/);
for (const id of ["dnd-5e", "dnd-5-5e"]) {
    const avatar = view(id, "monster.avatar-of-death");
    assert.match(avatar.textContent, /Half the hit point maximum of its summoner/);
    assert.match(avatar.textContent, /0 XP/);
    assert.doesNotMatch(avatar.textContent, /CR null/);
    assert.match(avatar.textContent, /60 ft\. \(hover\)/);
    const condition = all(avatar, node => node.tagName === "A" && node.textContent === "condition.charmed")[0];
    assert.ok(condition);
    assert.ok(condition.attrs.href.includes("/rulesets/" + id + "/rules/condition.charmed"));
    const dragon = view(id, "monster.adult-red-dragon");
    assert.match(dragon.textContent, /Legendary Actions/);
}
assert.match(view("dnd-5-5e", "monster.avatar-of-death").textContent, /\+3 \(13\)/);
assert.match(view("dnd-5e", "monster.acolyte").textContent, /3.*bless/is);
const priest = view("dnd-5-5e", "monster.priest-acolyte");
assert.match(priest.textContent, /Divine Aid/);
const spell = all(priest, node => node.tagName === "A" && node.textContent === "spell.bless")[0];
assert.ok(spell.attrs.href.includes("/rulesets/dnd-5-5e/rules/spell.bless"));
assert.match(view("dnd-5-5e", "monster.adult-red-dragon").textContent, /Lair XP 20000/);
const spirit = view("dnd-5-5e", "monster.draconic-spirit-acid");
assert.match(spirit.textContent, /14 \+ the spell's level/);
assert.match(spirit.textContent, /50 \+ 10 for each spell level above 5/);
assert.match(spirit.textContent, /equals your Proficiency Bonus/);
assert.match(view("dnd-5-5e", "monster.animated-object-huge").textContent, /Animate Objects/);
console.log("Imported native creature fixture checks passed.");

const oldSwarm = view("dnd-5e", "monster.swarm-of-bats");
assert.match(oldSwarm.textContent, /Medium · Swarm of Tiny Beast/);
assert.match(oldSwarm.textContent, /0 ft\./);
const newSwarm = view("dnd-5-5e", "monster.swarm-of-insects");
assert.match(newSwarm.textContent, /20 ft\. \(Climb or Fly\) \(GM's choice\)/);
assert.match(view("dnd-5e", "monster.acolyte").textContent, /Level 1 \(3 slots\)/);
const firstPartyRecords = ["monster.goblin-warrior", "monster.tarrasque"].map(id => JSON.parse(fs.readFileSync(
    new URL("./fixtures/multi-system/first-party-001--" + id + ".json", import.meta.url))));
for (const record of firstPartyRecords) {
    const target = new FakeNode("main");
    renderNativeDetail(target, { rulesetId: "first-party-001", fingerprint: "fixture-only",
        rule: { id: record.id, name: record.name, kind: record.kind, definition: record } }, () => {});
    assert.equal(cls(target, "rw-statblock").length, 1);
    assert.match(target.textContent, /Armor Class/);
    assert.match(target.textContent, /Actions/);
    assert.equal(cls(target, "rw-statblock-kaiju").length, 0);
}
const sparse = show({name:"Sparse source", challenge:"2", str:"variable", ac:[{special:"depends on summoner"}]});
assert.match(sparse.textContent, /CR 2/);
assert.match(sparse.textContent, /variable/);
assert.match(sparse.textContent, /depends on summoner/);

assert.match(view("dnd-5e", "monster.green-hag").textContent, /Coven CR 5/);
assert.match(view("dnd-5-5e", "monster.otherworldly-steed").textContent, /Celestial or Fey or Fiend/);

 // Independent seam validation: the structured renderer receives the exact
 // context and the bounded dice callback, without copying B's implementation.
const importedRecord = imported.find(x => x.rulesetId === "dnd-5e" && x.record.id === "monster.acolyte").record;
const context = { rulesetId: "dnd-5e", fingerprint: "fixture-only", campaignId: null, campaignRevisionId: null };
const adapterInput = { context, record: importedRecord,
    rule: { id: importedRecord.id, kind: importedRecord.kind, name: importedRecord.name, definition: importedRecord },
    references: null, hrefForRule: id => "/rulesets/dnd-5e/rules/" + id };
let structuredCalls = 0;
const sharedProbe = { renderInlineContent() {}, renderStructuredContent(value, options) {
    structuredCalls++;
    assert.equal(options.input, adapterInput);
    assert.equal(options.renderDice, renderMonsterDice);
    const node = new FakeNode("span"); node.textContent = JSON.stringify(value); return node;
}, renderNativeAttribution: () => new FakeNode("aside") };
const noReader = renderImportedCreature(adapterInput, sharedProbe);
assert.ok(structuredCalls > 0);
assert.equal(all(noReader, n => n.tagName === "A").length, 0, "No unbound catalog links.");
assert.equal(renderMonsterDice({tag:"damage",expression:"1d6 + summonSpellLevel"}), null);
assert.equal(renderMonsterDice({tag:"dice",expression:"999d9999"}), null);
assert.equal(renderMonsterDice({tag:"hit",expression:"4"}).textContent, "+4");

// The real B integration cases activate when its public shared exports arrive.
// The pinned native reader returns only exact same-catalog fixture envelopes.
const referenceFixtures = JSON.parse(fs.readFileSync(new URL("./fixtures/multi-system/creature-workstream-c-references.json", import.meta.url)));
assert.match(view("dnd-5-5e", "monster.tarrasque").textContent, /697/);
const sourceMap = new Map([["{@spell bless}", "spell.bless"]]);
const asyncInput = { ...adapterInput, references: { context, resolve() {} } };
let prepared = false;
const asyncSharedProbe = { ...sharedProbe,
    async resolveSourceReferenceIds(input) { assert.equal(input, asyncInput); prepared = true; return sourceMap; },
    renderStructuredContent(value, options) {
        assert.equal(options.input, asyncInput);
        assert.equal(options.referenceIds, sourceMap);
        const node = new FakeNode("span"); node.textContent = JSON.stringify(value); return node;
    }
};
await renderImportedCreature(asyncInput, asyncSharedProbe);
assert.ok(prepared);
if (typeof sharedPresentation.resolveSourceReferenceIds === "function" && typeof sharedPresentation.renderInlineContent === "function") {
    for (const [rulesetId, creatureId, referenceId] of [
        ["dnd-5e", "monster.acolyte", "spell.bless"],
        ["dnd-5-5e", "monster.priest-acolyte", "spell.bless"],
        ["dnd-5e", "monster.adult-red-dragon", "condition.frightened"],
        ["dnd-5-5e", "monster.tarrasque", "condition.frightened"]
    ]) {
        const { record } = imported.find(x => x.rulesetId === rulesetId && x.record.id === creatureId);
        const context = { rulesetId, fingerprint: "fixture-only", campaignId: null, campaignRevisionId: null };
        const reader = { context, packageDescriptor: null, async resolve(id) {
            const entry = referenceFixtures.find(x => x.rulesetId === rulesetId && x.record.id === id);
            if (!entry) throw Error("Not supplied by this fixture reader");
            return { rulesetId, fingerprint: context.fingerprint,
                rule: { id, kind: entry.record.kind, name: entry.record.name, definition: entry.record } };
        }};
        const target = new FakeNode("main");
        await renderNativeDetail(target, { rulesetId, fingerprint: context.fingerprint,
            rule: { id: creatureId, name: record.name, kind: record.kind, definition: record } }, () => {}, null, { reader });
        const links = all(target, node => node.tagName === "A" && node.attrs.href?.endsWith("/rules/" + referenceId));
        assert.ok(links.some(node => node.textContent !== referenceId), "Expected an embedded reference, not only catalog list");
        assert.ok(links.every(node => node.attrs.href.includes("/rulesets/" + rulesetId + "/rules/")));
    }
    console.log("Shared creature inline reference integration checks passed.");
}
