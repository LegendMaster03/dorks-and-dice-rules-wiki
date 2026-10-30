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
const kaijuReference = {
    chaosThreshold: 150, finishingBlow: 60, vulnerabilityIdentificationDc: 18,
    xpMilestones: [{ criteria: "Chaos reduced to zero", xp: 5000 }, { criteria: "Victory", xp: 10000 }],
    vulnerableAreas: [
        { id: "head", name: "Head", maxHp: 35,
            targetableWhen: "When exposed by the creature's Behaviour",
            exploitationEffect: "Area-specific consequence", futureAreaRule: "Keep this detail",
            variants: [{ cr: 12, ac: 15, hp: 35 }, { cr: 18, ac: 18, hp: 65 },
                { cr: 24, ac: 21, hp: 105 }] },
        { id: "arm", name: "Arm", hp: 25, ac: 17, onExploited: "Additional effect" }
    ],
    behaviours: [
        { name: "Escalation", trigger: "At the stated encounter trigger", entries: ["Change combat behavior"],
            gainedFeatures: ["New Slam"], lostFeatures: ["Old Slam"] },
        { name: "Counterattack", when: "In response to an attack", description: "Use the listed counterattack" }
    ],
    rampage: "When Chaos Threshold reaches zero",
    deathThroes: "Once all Vulnerable Areas are exploited",
    deathRattle: "Post-defeat consequence",
    additionalKaijuRule: { effect: "preserve unexplained mechanics" }
};
const kaiju = show({
    name: "Kaiju Reference Fixture", blockType: "kaiju", size: ["G"], type: "monstrosity",
    ac: [22], hp: { average: 999, formula: "99d10" }, speed: { walk: 40 },
    str: 26, dex: 10, con: 24, int: 8, wis: 12, cha: 8,
    kaiju: kaijuReference,
    action: [{ name: "Slam", lostWhile: "Head Exploited",
        entries: ["{@atkr m} {@hit 10}, {@h}{@damage 3d10 + 8} force."] }],
    legendary: [{ name: "Legendary Action", entries: ["Special attack."] }]
});
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