import assert from "node:assert/strict";
import fs from "node:fs";
import { renderNativeMonster } from "../src/RulesWiki.Web/wwwroot/native-monster-detail.js";
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

// Mirror the actual native/bestiary/baboon.json envelope returned by Core.
// Previous tests passed flat definitions, missing the deployed UI failure where
// the nested creature data was printed as one giant "Definition" extra.
const baboonRecord = {
    id: "monster.baboon", name: "Baboon", kind: "monster",
    definition: {
        size: ["S"], type: "beast", alignment: ["U"], ac: [12],
        hp: { average: 3, formula: "1d6" }, speed: { walk: 30, climb: 30 },
        str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 6,
        passive: 11, cr: "0",
        trait: [{ name: "Pack Tactics", entries: [
            "The baboon has {@variantrule Advantage|SRD52} on an attack roll."
        ] }],
        action: [{ name: "Bite", entries: [
            "{@atkr m} {@hit 1}, reach 5 ft. {@h}1 ({@damage 1d4 - 1}) Piercing damage."
        ] }],
        familiar: true,
        lore: [{ name: "Baboon", _copy: { name: "Animals", source: "SRD52",
            _mod: { images: { mode: "prependArr", items: [
                { type: "image", href: { type: "internal", path: "bestiary/XMM/Baboon.webp" }, width: 884, height: 1000 }
            ] } } } }]
    },
    statBlockFoundationId: "rule.monster-statblock-foundation"
};
const baboon = show(baboonRecord);
assert.match(baboon.textContent, /Small · Beast · Unaligned/);
assert.match(baboon.textContent, /CR 0/);
assert.match(baboon.textContent, /Armor Class12/);
assert.match(baboon.textContent, /Hit Points3 \(1d6\)/);
assert.match(baboon.textContent, /30 ft., Climb 30 ft./);
assert.equal(cls(baboon, "rw-stat-ability").length, 6);
assert.match(baboon.textContent, /STR8 \(-1\)Save -1/);
assert.match(baboon.textContent, /Pack Tactics/);
assert.match(baboon.textContent, /Bite/);
assert.ok(cls(baboon, "rw-stat-roll").length >= 2);
assert.equal(cls(baboon, "rw-stat-source").length, 1, "Lore must stay in collapsed supplementary content.");
assert.doesNotMatch(baboon.textContent, /Additional MechanicsDefinition/);
assert.match(baboon.textContent, /Stat Block Foundation Id/);

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
// Exercise the same path used by the active Wiki detail panel, not only the
// standalone renderer. The API returns the complete entity as rule.definition.
const integratedBaboon = new FakeNode("main");
renderNativeDetail(integratedBaboon, {
    rulesetId: "first-party-001", fingerprint: "test",
    rule: { id: baboonRecord.id, name: baboonRecord.name, kind: "monster", definition: baboonRecord }
}, () => {});
assert.equal(cls(integratedBaboon, "rw-statblock").length, 1);
assert.equal(cls(integratedBaboon, "rw-stat-tile").length, 3);
assert.equal(cls(integratedBaboon, "rw-stat-ability").length, 6);
assert.equal(cls(integratedBaboon, "rw-stat-entry").length, 2);
assert.doesNotMatch(integratedBaboon.textContent, /Additional MechanicsDefinition/);

console.log("Native monster statblock renderer checks passed.");
