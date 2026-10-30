import assert from "node:assert/strict";
import { renderNativeDetail } from "../src/RulesWiki.Web/wwwroot/native-rule-detail.js";

// A minimal DOM for this dependency-free, server-side renderer check.
class FakeNode {
    constructor(tagName = "#text") {
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.attrs = {};
        this.dataset = {};
        this._text = "";
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            contains: name => this._classes.has(name),
            remove: (...names) => names.forEach(name => this._classes.delete(name))
        };
    }
    set className(value) { this._classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(" "); }
    set textContent(value) { this._text = String(value); this.childNodes = []; }
    get textContent() { return this._text + this.childNodes.map(child => child.textContent).join(""); }
    get children() { return this.childNodes.filter(node => node instanceof FakeNode && node.tagName !== "#TEXT"); }
    append(...children) {
        for (const child of children.flat(Infinity)) {
            if (child === null || child === undefined || child === false) continue;
            this.childNodes.push(child instanceof FakeNode ? child : new FakeText(String(child)));
        }
    }
    replaceChildren(...children) { this._text = ""; this.childNodes = []; this.append(...children); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    addEventListener() {}
}
class FakeText extends FakeNode { constructor(value) { super("#text"); this._text = value; } }
globalThis.Node = FakeNode;
globalThis.document = {
    createElement: name => new FakeNode(name),
    createTextNode: value => new FakeText(value)
};
globalThis.window = { location: { pathname: "/tools/rules-wiki/rules/condition.stunned", search: "" } };

const nodes = (root, predicate) => [root, ...root.children.flatMap(child => nodes(child, predicate))].filter(predicate);
const show = (rule, app = null) => {
    const root = new FakeNode("main");
    renderNativeDetail(root, { rule, rulesetId: "first-party-001", fingerprint: "fixture" }, () => {}, app);
    return root;
};
const make = (id, kind, definition) => ({ id, name: id.split(".").at(-1), kind, definition });
const app = {
    hostContext: { toolBasePath: "/tools/rules-wiki" }, browserScope: "global",
    browserFilters: { entityType: "condition", query: "", fieldFilters: {} },
    browserSort: {}
};

const stunned = show(make("condition.stunned", "condition", {
    description: "A creature is Incapacitated.",
    appliesConditions: ["condition.incapacitated"],
    effects: [
        { type: "speed", operation: "multiply", factor: 0.5 },
        { type: "speech", availability: "faltering-only" },
        { type: "saving-throw", ability: "strength", result: "automatic-failure" },
        { type: "saving-throw", ability: "dexterity", result: "automatic-failure" },
        { type: "defense-adjustment", operation: "suppress-contributions", contributions: ["positive-dexterity", "dodge"], oncePerComponent: true },
        { type: "defense-adjustment", operation: "add-modifier", defense: "armor-class", value: -2 }
    ]
}), app);
assert.match(stunned.textContent, /Speed becomes 50% of normal/);
assert.match(stunned.textContent, /Automatically fails Strength and Dexterity saving throws/);
assert.match(stunned.textContent, /−2 to Armor Class/);
assert.match(stunned.textContent, /each once/);
assert.equal(nodes(stunned, node => node.className.includes("rules-wiki-condition-effect-row")).length, 5);
assert.ok(nodes(stunned, node => node.tagName === "A" && node.textContent === "Incapacitated"
    && node.attrs.href === "/tools/rules-wiki/rules/condition.incapacitated").length);
assert.equal(nodes(stunned, node => node.tagName === "DETAILS").length, 1);
assert.equal(nodes(stunned, node => node.tagName === "DETAILS")[0].attrs.open, undefined);

const wet = show(make("condition.wet", "condition", {
    effects: [
        { type: "roll-mode", appliesTo: "saving-throw", mode: "disadvantage", when: {
            sourceKind: ["spell", "effect"], sourceDealsAnyDamageType: ["cold", "lightning"]
        } },
        { type: "roll-mode", appliesTo: "saving-throw", mode: "disadvantage",
            when: { purpose: "resist-extreme-cold" } }
    ],
    endsWhen: [{ event: "takes-damage", damageType: "fire", minimumDamageTaken: 5, sameDamageInstance: true },
        { event: "removes-wet-clothing-or-armor", unless: { hasWetFur: true } }]
}));
assert.match(wet.textContent, /it deals cold or lightning damage/);
assert.match(wet.textContent, /When resisting extreme cold/);
assert.match(wet.textContent, /at least 5 damage; in one instance/);
assert.match(wet.textContent, /Unless the creature has wet fur/);

// Navigating from a filtered Stunned result must not leave the list filtered
// to Stunned while the related Incapacitated detail is displayed.
window.location.search = "?q=Stunned&sort=name&dir=desc&source=legacy&f.ability=strength";
const filteredApp = {
    ...app,
    browserFilters: {
        ...app.browserFilters,
        query: "Stunned",
        sourceCode: "legacy",
        fieldFilters: { ability: "strength" }
    },
    browserSort: { key: "name", direction: "desc" }
};
const filteredStunned = show(make("condition.stunned", "condition", {
    appliesConditions: ["condition.incapacitated"]
}), filteredApp);
const filteredHref = nodes(filteredStunned, node => node.tagName === "A")[0].attrs.href;
assert.equal(filteredHref, "/tools/rules-wiki/rules/condition.incapacitated");
window.location.search = "";

// Formatting an existing effect type must not conceal newly introduced fields.
const extended = show(make("condition.extended", "condition", {
    effects: [
        { type: "roll-mode", appliesTo: "attack-roll", mode: "disadvantage", futureRestriction: "range-limited" },
        { type: "action-restriction", prohibited: ["physical-action"], scope: "physical-actions" },
        { type: "critical-hit", result: "automatic-critical-hit",
            subject: "attacks-against-affected-creature",
            when: { attackHits: true, attackerWithinFeet: 5, specialTrigger: "ritual-complete" } },
        { type: "critical-hit", result: "unfamiliar-critical-result", subject: "other-subject", when: { attackHits: true } },
        { type: "roll-modifier", operation: "multiply", appliesTo: "attack-roll", value: 2 },
        null
    ]
}));
assert.match(extended.textContent, /Future Restriction: Range limited/);
assert.match(extended.textContent, /Scope: Physical actions/);
assert.match(extended.textContent, /When Special Trigger: Ritual complete/);
assert.match(extended.textContent, /unfamiliar-critical-result/);
assert.match(extended.textContent, /multiply/);
assert.doesNotMatch(extended.textContent, /undefined|NaN/);
assert.equal(nodes(extended, node => node.className.includes("rules-wiki-condition-effect-row")).length, 6);

const exhaustion = show(make("condition.exhaustion", "leveled-condition", {
    levelRules: { stacking: "Effects are cumulative.", gain: "Increase by the stated amount." },
    levels: [
        { level: 1, effects: [{ type: "roll-mode", appliesTo: "ability-check", mode: "disadvantage" }] },
        { level: 4, effects: [{ type: "maximum-hit-points", operation: "multiply", factor: 0.5 }] },
        { level: 6, effects: [{ type: "death" }] }
    ],
    recovery: { general: "Effects reduce levels.", longRest: { levelsRemoved: 1, requirements: ["food-consumed", "drink-consumed"] } }
}));
assert.match(exhaustion.textContent, /Effects are cumulative/);
assert.match(exhaustion.textContent, /Maximum Hit PointsMaximum Hit Points becomes 50% of normal/);
assert.match(exhaustion.textContent, /The creature dies/);
assert.match(exhaustion.textContent, /Long rest: remove 1 exhaustion level/);
assert.equal(nodes(exhaustion, node => node.tagName === "TR").length, 4);

const panicked = show(make("condition.panicked", "condition", {
    onApply: [{ event: "drop-held-objects" }],
    derivedConditions: [{ condition: "condition.cowering", when: { escapeRouteAvailable: false }, endsWhen: { escapeRouteAvailable: true } }]
}), app);
assert.match(panicked.textContent, /Drops held objects/);
assert.match(panicked.textContent, /When no escape route is available/);
assert.ok(nodes(panicked, node => node.tagName === "A" && node.attrs.href?.endsWith("/condition.cowering")).length);

const petrified = show(make("condition.petrified", "condition", {
    description: "Awareness is not inherently removed.",
    appliesConditions: ["condition.incapacitated"],
    effects: [
        { type: "damage-resistance", damageTypes: "all" },
        { type: "immunity", damageType: "poison" },
        { type: "existing-affliction", afflictions: ["poison", "disease"], operation: "suspend-not-neutralize", resumeWhenConditionEnds: true }
    ]
}), app);
assert.match(petrified.textContent, /Awareness is not inherently removed/);
assert.match(petrified.textContent, /Resistance to all damage/);
assert.match(petrified.textContent, /Poison damage immunity/);
assert.match(petrified.textContent, /They resume when this condition ends/);

const pinned = show(make("condition.pinned", "condition", {
    appliesConditions: ["condition.grappled"],
    requiresConditions: [{ condition: "condition.grappled", sourceRelation: "same-pinner" }],
    effects: [
        { type: "speech", availability: "none", when: { pinningCreatureElectsToSilence: true } },
        { type: "spellcasting-restriction", prohibitedComponents: ["somatic"], materialComponents: "must-already-be-in-hand", focus: "must-already-be-in-hand", concentrationCheck: { baseDC: 20, perSpellLevel: 1 }, runtimeMapping: "pending-native-spellcasting-reconciliation" }
    ],
    escapeOptions: [{ method: "opposed-grapple-check", sourceActionCost: "replaces-one-attack" }]
}), app);
assert.match(pinned.textContent, /When the pinner chooses to silence the creature/);
assert.match(pinned.textContent, /Concentration check DC 20 \+ 1 per spell level/);
assert.match(pinned.textContent, /Runtime mapping: Pending native spellcasting reconciliation/);
assert.match(pinned.textContent, /Opposed grapple check/);
assert.ok(nodes(pinned, node => node.tagName === "A" && node.attrs.href?.endsWith("/condition.grappled")).length === 2);

const unknown = show(make("condition.test", "condition", {
    effects: [{ type: "future-new-effect", unusualKey: "must-not-disappear" }],
    experimentalMechanic: { linked: true }
}));
assert.match(unknown.textContent, /Future new effect/);
assert.match(unknown.textContent, /must-not-disappear/);
assert.match(unknown.textContent, /Experimental Mechanic/);

const generic = show(make("spell.test", "spell", { effects: [{ type: "speed", factor: 0.5 }] }));
assert.equal(nodes(generic, node => node.className.includes("rules-wiki-condition-detail")).length, 0);
assert.match(generic.textContent, /Effects/);
console.log("Native condition reference renderer checks passed.");
