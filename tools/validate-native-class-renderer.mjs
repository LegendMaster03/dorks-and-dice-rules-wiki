import assert from "node:assert/strict";
import { renderNativeClass } from "../src/RulesWiki.Web/wwwroot/native-class-detail.js";
import { discoverOwnedOptions } from "../src/RulesWiki.Web/wwwroot/native-class-customization.js";

class FakeNode {
    constructor(tagName = "#text") {
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.attrs = {};
        this.listeners = new Map();
        this.value = "";
        this.open = false;
        this._text = "";
        this._classes = new Set();
        this.classList = {
            add: (...xs) => xs.forEach(x => this._classes.add(x)),
            contains: x => this._classes.has(x),
            toggle: (x, state) => state ? this._classes.add(x) : this._classes.delete(x)
        };
    }
    set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(" "); }
    set textContent(value) { this._text = String(value); this.childNodes = []; }
    get textContent() { return this._text + this.childNodes.map(child => child.textContent).join(""); }
    get children() { return this.childNodes.filter(child => child.tagName !== "#TEXT"); }
    append(...children) {
        for (const child of children.flat(Infinity)) {
            if (child === null || child === undefined || child === false) continue;
            this.childNodes.push(child instanceof FakeNode ? child : new FakeText(String(child)));
        }
    }
    replaceChildren(...children) { this._text = ""; this.childNodes = []; this.append(...children); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    addEventListener(name, handler) {
        if (!this.listeners.has(name)) this.listeners.set(name, []);
        this.listeners.get(name).push(handler);
    }
    dispatch(name) { for (const handler of this.listeners.get(name) ?? []) handler({ target: this }); }
    scrollIntoView() { this.scrolled = true; }
}
class FakeText extends FakeNode { constructor(value) { super("#text"); this._text = value; } }
globalThis.Node = FakeNode;
const head = new FakeNode("head");
globalThis.document = {
    head,
    createElement: tag => new FakeNode(tag),
    createTextNode: value => new FakeText(value),
    getElementById: id => nodes(head, node => node.attrs.id === id)[0] ?? null
};
const nodes = (root, predicate) => [root, ...root.children.flatMap(child => nodes(child, predicate))].filter(predicate);
const renderValue = value => {
    const safe = new FakeNode("pre");
    safe.textContent = JSON.stringify(value);
    return safe;
};
const rule = (name, definition) => ({ id: `class.${name.toLowerCase()}`, name, kind: "class", definition });
const foo = () => ({ level: 1, featureGrants: ["class-feature.sorcerer.innate-sorcery-level-1"],
    improvements: [], baseAttackBonus: 0, baseSaves: { fortitude: 0, reflex: 0, will: 2 },
    sorceryPointMaximum: 0, spellSlotsBySpellLevel: [2,0,0,0,0,0,0,0,0] });
const sorcerer = rule("Sorcerer", {
    hitDie: { number: 1, faces: 6 },
    spellcastingAbility: "charisma", savingThrowProficiencies: ["constitution", "charisma"],
    skillChoices: { count: 2, from: ["arcana", "persuasion"] },
    subclassFeatureLevels: [3,6,14,18], subclasses: "excluded-until-subclass-pass",
    progression: [foo(), { ...foo(), level: 2, sorceryPointMaximum: 2,
        featureGrants: ["class-feature.sorcerer.font-of-magic-level-2"],
        baseSaves: { fortitude: 0, reflex: 0, will: 3 }, spellSlotsBySpellLevel: [3,0,0,0,0,0,0,0,0] }],
    metamagicOptionsKnownBySorcererLevel: [[2, 2], [10, 4], [17, 6]]
});
const requested = [];
const content = renderNativeClass(sorcerer, {
    renderValue,
    hrefForRule: id => `/tools/rules-wiki/rules/${encodeURIComponent(id)}`,
    getRule: id => { requested.push(id); return Promise.resolve({ rule: { id, name: "Font of Magic",
        definition: { description: "Resource recovery feature." } } }); }
});
assert.equal(nodes(head, el => el.tagName === "LINK").length, 1);
assert.match(content.textContent, /Sorcerer/);
assert.match(content.textContent, /Sorcery points/);
assert.match(content.textContent, /Sorcery points/);
assert.match(content.textContent, /2d6|d6/); // Regression check: dice objects are legible.
assert.match(content.textContent, /Fort/);
assert.match(content.textContent, /Ref/);
assert.match(content.textContent, /Will/);
assert.match(content.textContent, /Spell slot progression by spell level/);
assert.match(content.textContent, /excluded until subclass pass/i);
assert.equal(nodes(content, el => el.tagName === "TR" && el.attrs["data-class-level"]).length, 2);
assert.equal(nodes(content, el => el.tagName === "DETAILS" && el.className === "native-class-feature").length, 2);
assert.equal(requested.length, 0, "Feature definitions should not be fetched until opened");
const detail = nodes(content, el => el.tagName === "DETAILS" && el.className === "native-class-feature")[1];
const link = nodes(detail, el => el.tagName === "A")[0];
assert.equal(link.attrs.href, "/tools/rules-wiki/rules/class-feature.sorcerer.font-of-magic-level-2");
const levelSelect = nodes(content, el => el.tagName === "SELECT")[0];
levelSelect.value = "2";
levelSelect.dispatch("change");
const highlighted = nodes(content, el => el.tagName === "TR" && el.classList.contains("is-selected"));
assert.equal(highlighted.length, 1);
assert.equal(highlighted[0].attrs["data-class-level"], "2");
const jumpToFeatures = nodes(content, el => el.tagName === "A"
    && el.className === "native-class-feature-jump")[0];
assert.equal(jumpToFeatures.hidden, false);
assert.equal(jumpToFeatures.attrs.href, "#native-class-features-level-2");
assert.match(jumpToFeatures.textContent, /Read level 2 features/);
const openFeatureGroup = nodes(content, el => el.tagName === "DETAILS"
    && el.attrs.id === "native-class-features-level-2")[0];
assert.equal(openFeatureGroup.open, true);
const featuresSection = nodes(content, el => el.tagName === "SECTION"
    && el.attrs.id === "native-class-features")[0];
assert.equal(featuresSection.scrolled, undefined,
    "Changing a level must not automatically jump away from the advancement table");
detail.open = true;
detail.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(requested, ["class-feature.sorcerer.font-of-magic-level-2"]);
assert.match(detail.textContent, /Resource recovery feature/);
assert.equal(nodes(detail, el => el.tagName === "A" && el.textContent === "Open full rule").length, 1,
    "Loaded feature must preserve navigation to its native record");
detail.dispatch("toggle");
assert.equal(requested.length, 1, "The feature is fetched once per detail view");

const cleric = rule("Cleric", {
    description: "Divine caster.",
    progression: [{ level: 1, featureGrants: ["cleric.historical-turn-undead"],
        baseSaves: { fortitude: 2, reflex: 0, will: 2 },
        channelDivinityUses: 2, availableChannelDivinityEffects: ["legacy-turn", "modern-turn"] }],
    inlineFeatures: [{ id: "cleric.historical-turn-undead", name: "Historical Turn Undead",
        classLevel: 1, description: "Historical procedure", mechanics: { action: "action" } }],
    subclasses: "excluded"
});
const clericView = renderNativeClass(cleric, { renderValue });
assert.match(clericView.textContent, /Historical Turn Undead/);
assert.match(clericView.textContent, /Channel Divinity/);
assert.match(clericView.textContent, /Complete advancement data/);
const inlineDetail = nodes(clericView, el => el.tagName === "DETAILS" && el.className === "native-class-feature")[0];
assert.match(inlineDetail.textContent, /Historical procedure/);
assert.equal(nodes(clericView, el => el.tagName === "A" && el.attrs.href === "#native-class-feature-cleric.historical-turn-undead").length, 1);
assert.equal(nodes(inlineDetail, el => el.tagName === "A").length, 0,
    "Inline features must not link to nonexistent native record IDs");

// The renderer does not assume a universal three-pillar class structure.
const experimental = renderNativeClass(rule("Example", {
    progression: [{ level: 1, featureGrants: [], pactSlots: 1, invocationCount: 1 }],
    customizationSystems: [{ name: "One-of-many", options: ["alpha", "beta"] }],
    subclassPresets: [{ name: "Traditional subclass", choices: ["alpha"] }]
}), { renderValue });
assert.match(experimental.textContent, /One-of-many/);
assert.match(experimental.textContent, /Traditional subclass presets/);
assert.match(experimental.textContent, /Pact slots/);
assert.match(experimental.textContent, /Invocation Count/);
assert.equal(nodes(head, el => el.tagName === "LINK").length, 1, "Stylesheet is registered only once");

// Representative field coverage for all seven classes present in the native
// Rules Core catalog during this phase (the source definitions remain Core-owned).
const layouts = [
    ["Barbarian", { rageUses: 2, battleRageDamage: 2, trapSense: 0, damageReduction: 0 }],
    ["Bard", { cantripsKnown: 4, leveledSpellsKnown: 4, spellSlotsBySpellLevel: [2, 0, 0] }],
    ["Cleric", { channelDivinityUses: 2, divineSparkDice: 0 }],
    ["Druid", { wildShapeCharges: 2, cantripsKnown: 2 }],
    ["Rogue", { sneakAttackDice: 1, specialAbilityChoice: "available" }],
    ["Sorcerer", { sorceryPointMaximum: 2, metamagicOptionsKnown: 2 }],
    ["Wizard", { wizardSpecializationChoicesGranted: 1, minimumLeveledSpellsAcquired: 6 }]
];
for (const [name, features] of layouts) {
    const view = renderNativeClass(rule(name, { progression: [
        { level: 1, featureGrants: [], ...features }
    ] }), { renderValue });
    assert.match(view.textContent, new RegExp(name));
    const labels = { rageUses: "Rages", battleRageDamage: "Rage damage",
        channelDivinityUses: "Channel Divinity", wildShapeCharges: "Wild Shape",
        sorceryPointMaximum: "Sorcery points", metamagicOptionsKnown: "Metamagic options",
        cantripsKnown: "Cantrips", leveledSpellsKnown: "Spells known" };
    for (const key of Object.keys(features).filter(key => typeof features[key] !== "object")) {
        const expected = labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\b\w/g, char => char.toUpperCase());
        assert.ok(view.textContent.includes(expected), `${name}: missing ${key}`);
    }
}

const improvement = renderNativeClass(rule("Improvement", { progression: [
    { level: 10, featureGrants: [], improvements: [{ name: "Deeper discipline", level: 10 }] }
] }), { renderValue });
assert.match(improvement.textContent, /Feature improvements/);
assert.match(improvement.textContent, /Deeper discipline/);

const noProgression = renderNativeClass(rule("Empty", { subclasses: "deferred" }), { renderValue });
assert.match(noProgression.textContent, /no structured advancement table/);
assert.match(noProgression.textContent, /not an available preset list/i);
assert.throws(() => renderNativeClass({ kind: "spell", definition: {} }, { renderValue }));
console.log("Native class renderer: progression, feature loading, inline features, customization, accessibility structure and empty data OK");

// Current native Warlock Alpha 0.3.1 contract: a class-specific pillarSystem
// points to distinct patron, pact and invocation rule records. Never interpret
// a Patron as a complete subclass preset unless an explicit preset exists.
const warlock = rule("Warlock", {
    alphaVersion: "0.3.1", rulesStatus: "selected-for-playtest; subject-to-change",
    description: "Patron, Pact, and Invocations establish the class.",
    separateGrants: { automaticEldritchBlast: true, mysticArcanumSeparate: true,
        pactMagicSlotsRecover: "short-or-long-rest" },
    progression: [
        { level: 1, featureGrants: ["class-feature.warlock.pact-magic"], proficiencyBonus: 2,
            fiendMilestones: [], invocationsElectiveTotal: 1, ordinaryCantripsKnown: 2,
            pactSlots: 1, pactSlotLevel: 1 },
        { level: 5, featureGrants: ["class-feature.warlock.deepened-pact"], proficiencyBonus: 3,
            fiendMilestones: ["Fiend spell access"], invocationsElectiveTotal: 4,
            pactSlots: 2, pactSlotLevel: 3 },
        { level: 8, featureGrants: [], fiendMilestones: ["Infernal Retaliation"],
            invocationsElectiveTotal: 5, pactSlots: 2, pactSlotLevel: 4 }
    ],
    pillarSystem: {
        patron: { requiredAtWarlockLevel: 1, activePatronIds: ["patron.warlock.fiend"] },
        pact: { requiredAtWarlockLevel: 1, firstChoiceFree: true,
            activePactIds: ["pact.warlock.blade", "pact.warlock.chain", "pact.warlock.tome", "pact.warlock.talisman"] },
        invocations: { firstChoiceAtWarlockLevel: 1, acquisitionLevels: [1,2,4,5],
            activeInvocationIds: ["invocation.agonizing-blast", "invocation.armor-of-shadows"] }
    }
});
const requestedWarlock = [];
const wrappedWarlock = { ...warlock, definition: { id: warlock.id,
    name: warlock.name, kind: warlock.kind, definition: warlock.definition } };
const warlockView = renderNativeClass(wrappedWarlock, { renderValue,
    hrefForRule: id => `/tools/rules-wiki/rules/${encodeURIComponent(id)}`,
    getRule: id => { requestedWarlock.push(id); return Promise.resolve({ rule: {
        id, name: "Pact of the Blade", kind: "pact", definition: {
            id, name: "Pact of the Blade", kind: "pact", description: "Manifest a pact weapon.",
            deepenedAtLevel5: "Attack twice with your Pact weapon."
        }
    } }); }
});
assert.match(warlockView.textContent, /Rules status: selected for playtest/);
assert.match(warlockView.textContent, /Alpha 0.3.1/);
assert.match(warlockView.textContent, /Spellcasting and resource notes/);
assert.match(warlockView.textContent, /Mystic Arcanum is separate from Pact Magic slots/);
assert.match(warlockView.textContent, /Fiend Milestones/);
assert.match(warlockView.textContent, /Infernal Retaliation/);
assert.match(warlockView.textContent, /Your first Pact does not cost an Invocation selection/);
assert.equal(nodes(warlockView, el => el.className === "native-class-customization-system").length, 3);
assert.equal(nodes(warlockView, el => el.className === "native-class-customization-option").length, 7);
assert.equal(nodes(warlockView, el => el.className === "native-class-preset").length, 0,
    "Patron must not automatically become an unsupported subclass preset");
const pactCard = nodes(warlockView, el => el.className === "native-class-customization-option"
    && el.attrs["data-option-id"] === "pact.warlock.blade")[0];
const pactDisclosure = nodes(pactCard, el => el.tagName === "DETAILS")[0];
assert.equal(requestedWarlock.length, 0, "Options are fetched only on expansion");
pactDisclosure.open = true;
pactDisclosure.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(requestedWarlock, ["pact.warlock.blade"]);
assert.match(pactCard.textContent, /Manifest a pact weapon/);
assert.match(pactCard.textContent, /Attack twice/);
assert.equal(nodes(pactCard, el => el.tagName === "A" && el.textContent === "Open full rule").length, 1);
const invocationSearch = nodes(warlockView, el => el.tagName === "INPUT"
    && el.attrs["aria-label"] === "Filter Invocations options by name")[0];
invocationSearch.value = "Agonizing";
invocationSearch.dispatch("input");
const invocationsOptions = nodes(warlockView, el => el.className === "native-class-customization-option"
    && el.attrs["data-option-id"]?.startsWith("invocation."));
assert.equal(invocationsOptions.filter(el => !el.hidden).length, 1);
assert.match(warlockView.textContent, /1 shown · 1 matching · 2 total/);

const presetView = renderNativeClass(rule("Template", {
    progression: [], subclassPresets: [{ id: "preset.example", name: "Familiar traditional subclass",
        description: "Defines one choice, not a whole build", choiceIds: ["option.one"] }]
}), { renderValue });
assert.equal(nodes(presetView, el => el.className === "native-class-preset").length, 1);
assert.match(presetView.textContent, /Defines one choice/);
assert.doesNotMatch(warlockView.textContent, /Traditional subclass presets/);
assert.match(presetView.textContent, /Only the choices explicitly defined by this preset/);
console.log("Native Warlock pilot: three distinct customization systems, lazy native options, filtering, status, and explicit presets OK");

// The live API wraps native class features in a second definition object.
const wrappedFeature = renderNativeClass(rule("Wrapped", {
    progression: [{ level: 1, featureGrants: ["class-feature.wrapped.special"] }]
}), { renderValue, getRule: id => Promise.resolve({ rule: {
    id, name: "Special Feature", kind: "classFeature", definition: {
        id, name: "Special Feature", kind: "classFeature", definition: {
            description: "Nested feature text", additionalRule: "Still visible"
        }
    }
} }) });
const wrappedDetail = nodes(wrappedFeature, el => el.className === "native-class-feature")[0];
wrappedDetail.open = true;
wrappedDetail.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(wrappedDetail.textContent, /Nested feature text/);
assert.match(wrappedDetail.textContent, /Still visible/);
assert.equal(nodes(wrappedDetail, el => el.tagName === "A").length, 1);
console.log("Private native API envelope regression: full class, option and feature records OK");

// Independent systems: class supplies identities only; definitions are fetched
// from separate native records. This is deliberately an adapter test, not a
// claim that Rules Core has finalized the future schema.
const separatedRequests = [];
const separated = renderNativeClass(rule("Separated", {
    progression: [{ level: 1, featureGrants: [], classMilestones: ["Choose a tradition"] }],
    customizationSystemIds: ["class-system.separated.traditions", "class-system.separated.disciplines"],
    subclassPresetIds: ["class-preset.separated.traditional"],
    subclasses: "deferred"
}), { renderValue, hrefForRule: id => `/tools/rules-wiki/rules/${id}`,
    getRule: id => {
        separatedRequests.push(id);
        if (id === "class-system.separated.traditions") return Promise.resolve({ rule: {
            id, name: "Traditions", definition: { id, name: "Traditions", kind: "classCustomizationSystem",
                rulesStatus: "selected-for-playtest",
                definition: { description: "Choose a tradition.", optionIds: ["class-option.separated.first", "class-option.separated.second"],
                    activationLevel: 1 }
            } } });
        if (id === "class-preset.separated.traditional") return Promise.resolve({ rule: {
            id, name: "Traditional Archetype", definition: { id, name: "Traditional Archetype",
                kind: "classPreset", definition: { choiceIds: ["class-option.separated.first"],
                    description: "Specifies one choice only." } } } });
        return Promise.resolve({ rule: { id, name: "Independent Option",
            definition: { id, name: "Independent Option", kind: "classOption",
                description: "Option in an independent record." } } });
    }
});
assert.match(separated.textContent, /Class Milestones/);
assert.equal(nodes(separated, el => el.className === "native-class-customization-system").length, 2);
assert.equal(nodes(separated, el => el.className === "native-class-preset").length, 1);
assert.equal(separatedRequests.length, 0, "Independent records must remain lazy");
const systemView = nodes(separated, el => el.className === "native-class-customization-system")[0];
assert.match(systemView.textContent, /Linked native system/);
systemView.open = true;
systemView.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(separatedRequests, ["class-system.separated.traditions"]);
assert.match(systemView.textContent, /Choose a tradition/);
assert.match(systemView.textContent, /selected-for-playtest/, "Outer native metadata must survive nesting");
assert.match(systemView.textContent, /2 referenced options/);
assert.equal(nodes(systemView, el => el.className === "native-class-customization-option").length, 2);
assert.equal(nodes(systemView, el => el.tagName === "A" && el.attrs.href?.endsWith("class-system.separated.traditions")).length, 1);
const independentOption = nodes(systemView, el => el.className === "native-class-customization-option")[0];
const independentDisclosure = nodes(independentOption, el => el.tagName === "DETAILS")[0];
independentDisclosure.open = true;
independentDisclosure.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(independentOption.textContent, /Independent Option/);
assert.match(independentOption.textContent, /independent record/);
const preset = nodes(separated, el => el.className === "native-class-preset")[0];
const presetDisclosure = nodes(preset, el => el.tagName === "DETAILS")[0];
presetDisclosure.open = true;
presetDisclosure.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(preset.textContent, /Traditional Archetype/);
assert.match(preset.textContent, /Specifies one choice only/);
assert.equal(nodes(preset, el => el.tagName === "A").length, 1);
assert.equal(nodes(separated, el => el.className === "native-class-preset").length, 1,
    "Deferred subclass marker must not create a preset");

// The revised adapter also accepts explicitly named options without needing
// to load them for label rendering; it never derives an option from a filename.
const indexed = renderNativeClass(rule("Indexed", {
    customizationSystems: [{ name: "Disciplines", options: [
        { id: "class-option.indexed.one", name: "First Disciple" },
        { id: "class-option.indexed.two", name: "Second Disciple" },
        { id: "class-option.indexed.one", name: "Duplicate" }
    ] }]
}), { renderValue });
assert.equal(nodes(indexed, el => el.className === "native-class-customization-option").length, 2);
assert.match(indexed.textContent, /First Disciple/);
console.log("Separated customization systems and explicit native preset references OK");

// Requirement identifiers are constraints, not automatically selectable
// options. Only explicit optionIds/options and transitional active...Ids
// define an option catalog.
const constrained = renderNativeClass(rule("Constraints", {
    customizationSystems: [{ name: "Tactics", requiredFeatIds: ["feat.combat-training"],
        options: [{ id: "class-option.constraints.tactical", name: "Tactical Choice" }] }],
    subclassPresetIds: [{ id: "class-preset.constraints.sample", name: "Named preset reference" }]
}), { renderValue });
assert.equal(nodes(constrained, el => el.className === "native-class-customization-option").length, 1);
assert.match(constrained.textContent, /feat.combat-training/);
assert.equal(nodes(constrained, el => el.className === "native-class-preset").length, 1);
assert.match(constrained.textContent, /View preset rules/);
console.log("Referenced constraints are not misidentified as choices OK");

// A class may refer to the same rule from more than one independent system.
// The reader must not issue duplicate requests or silently merge the systems.
const sharedRequests = [];
const shared = renderNativeClass(rule("Shared", {
    customizationSystems: [
        { name: "First", optionIds: ["class-option.shared.reusable"] },
        { name: "Second", optionIds: ["class-option.shared.reusable"] }
    ]
}), { renderValue, getRule: id => {
    sharedRequests.push(id);
    return Promise.resolve({ rule: { id, name: "Reusable Option", definition: {
        description: "A rule referenced by multiple systems." } } });
} });
const disclosures = nodes(shared, el => el.className === "native-class-customization-option-detail");
assert.equal(disclosures.length, 2);
for (const disclosure of disclosures) { disclosure.open = true; disclosure.dispatch("toggle"); }
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(sharedRequests, ["class-option.shared.reusable"]);
assert.equal(nodes(shared, el => el.className === "native-class-customization-option").length, 2);
console.log("Shared native identity request deduplication OK");

// Current Rules Core native Warlock layout (October 30): base class has
// selectionRules, and the Patron/Pact/Invocation definitions are individual
// native entities with parentClass, NOT embedded option lists. The private
// reference catalog exposes category-filtered summaries only, so ownership
// is verified on the corresponding detail records.
const catalogFingerprint = "native-snapshot-a";
const newWarlock = renderNativeClass(rule("Warlock", {
    rulesStatus: "selected-for-playtest; subject-to-change",
    alphaVersion: "0.3.1",
    progression: [{ level: 1, featureGrants: [], invocationsElectiveTotal: 1 }],
    selectionRules: {
        patron: { requiredAtWarlockLevel: 1, playtestPatronId: "patron.warlock.fiend" },
        pact: { requiredAtWarlockLevel: 1, firstChoiceFree: true },
        invocations: { firstChoiceAtWarlockLevel: 1, everyChoiceAttachedToOneActualPact: true }
    }
}), { renderValue, catalogFingerprint,
    searchRules: async ({ category, limit, offset }) => {
        newSearches.push({ category, limit, offset });
        return { fingerprint: catalogFingerprint, total: newEntries[category].length,
            rules: newEntries[category].slice(offset, offset + limit).map(({ id, name }) => ({
                id, name, kind: category
            })) };
    },
    getRule: async id => {
        newReads.push(id);
        const record = Object.values(newEntries).flat().find(entry => entry.id === id);
        return { fingerprint: catalogFingerprint, rule: { id, name: record?.name ?? id,
            kind: record?.kind ?? "pact", definition: { ...record } } };
    }
});
const newSearches = [];
const newReads = [];
const newEntries = {
    patron: [
        { id: "patron.warlock.fiend", name: "The Fiend", kind: "patron", parentClass: "class.warlock" },
        { id: "patron.other.stranger", name: "Stranger", kind: "patron", parentClass: "class.other" }
    ],
    pact: [
        { id: "pact.warlock.blade", name: "Pact of the Blade", kind: "pact", parentClass: "class.warlock",
            description: "An independent Pact with its own rules." },
        { id: "pact.warlock.tome", name: "Pact of the Tome", kind: "pact", parentClass: "class.warlock" },
        { id: "pact.other.foreign", name: "Foreign Pact", kind: "pact", parentClass: "class.other" }
    ],
    invocation: [
        { id: "invocation.agonizing-blast", name: "Agonizing Blast", kind: "invocation",
            parentClass: "class.warlock", minimumWarlockLevel: 2 },
        { id: "invocation.armor-of-shadows", name: "Armor of Shadows", kind: "invocation",
            parentClass: "class.warlock" }
    ]
};
const liveSystems = nodes(newWarlock, el => el.className === "native-class-customization-system");
assert.equal(liveSystems.length, 3);
assert.equal(newSearches.length, 0, "Catalog discovery must be lazy");
assert.equal(newReads.length, 0, "Option reads must be lazy");
assert.equal(nodes(newWarlock, el => el.className === "native-class-customization-option").length, 0);
assert.doesNotMatch(newWarlock.textContent, /Traditional subclass presets/,
    "The Fiend is a Patron, not an implicitly complete subclass preset");
for (const system of liveSystems) {
    system.open = true;
    system.dispatch("toggle");
    await new Promise(resolve => setImmediate(resolve));
}
assert.deepEqual(newSearches.map(value => value.category).sort(), ["invocation", "pact", "patron"]);
assert.equal(newReads.length, 7);
assert.equal(nodes(newWarlock, el => el.className === "native-class-customization-option").length, 5,
    "Only native entities belonging to this class should appear");
assert.match(newWarlock.textContent, /Pact of the Blade/);
assert.match(newWarlock.textContent, /Agonizing Blast/);
assert.match(newWarlock.textContent, /Your first Pact does not cost an Invocation selection/);
assert.doesNotMatch(newWarlock.textContent, /Foreign Pact/);
const newPact = nodes(newWarlock, el => el.attrs["data-option-id"] === "pact.warlock.blade")[0];
const newPactDisclosure = nodes(newPact, el => el.tagName === "DETAILS")[0];
newPactDisclosure.open = true;
newPactDisclosure.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(newPact.textContent, /An independent Pact/);
assert.equal(newReads.filter(value => value === "pact.warlock.blade").length, 1,
    "Opening an already-discovered option should reuse the cached native rule");

const fingerprintMismatch = renderNativeClass(rule("Warlock", {
    selectionRules: { pact: { firstChoiceFree: true } }
}), { renderValue, catalogFingerprint, searchRules: async () => ({
    fingerprint: "different-snapshot", total: 1,
    rules: [{ id: "pact.warlock.blade", name: "Blade", kind: "pact" }]
}), getRule: async () => { throw new Error("Must not read mixed snapshots"); } });
const mismatchSystem = nodes(fingerprintMismatch, el => el.className === "native-class-customization-system")[0];
mismatchSystem.open = true;
mismatchSystem.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(mismatchSystem.textContent, /could not be loaded/i);
assert.equal(nodes(mismatchSystem, el => el.className === "native-class-customization-option").length, 0);
console.log("Reorganized Warlock selectionRules: independent native discovery, ownership, lazy reads and snapshot safety OK");

// The private Core endpoint caps catalog pages at 100 records. Verify the
// adapter pages correctly and never sends an unbounded burst of detail reads.
const candidates = Array.from({ length: 103 }, (_, index) => ({
    id: `invocation.example-${index}`, name: `Example ${index}`, kind: "invocation"
}));
const offsets = [];
let activeReads = 0;
let maximumReads = 0;
const paged = await discoverOwnedOptions("invocation", "class.example", {
    fingerprint: "snapshot-b",
    searchRules: async ({ category, limit, offset }) => {
        assert.equal(category, "invocation");
        assert.equal(limit, 100);
        offsets.push(offset);
        return { fingerprint: "snapshot-b", total: candidates.length,
            rules: candidates.slice(offset, offset + limit) };
    },
    getRule: async id => {
        activeReads++;
        maximumReads = Math.max(maximumReads, activeReads);
        await Promise.resolve();
        activeReads--;
        const index = Number(id.split("-").at(-1));
        return { fingerprint: "snapshot-b", rule: { id, name: `Example ${index}`,
            definition: { id, parentClass: index < 2 ? "class.example" : "class.other" } } };
    }
});
assert.deepEqual(offsets, [0, 100]);
assert.deepEqual(paged.map(option => option.id), ["invocation.example-0", "invocation.example-1"]);
assert.ok(maximumReads <= 6, "Native lookups must respect the concurrency limit");
await assert.rejects(discoverOwnedOptions("pact", "class.example", {
    fingerprint: "snapshot-b", searchRules: async () => ({ total: 0, rules: [] }),
    getRule: async () => { throw new Error("Unexpected read"); }
}), /catalog changed or returned invalid results/);
console.log("Native catalog pagination, bounded concurrency, and strict fingerprint matching OK");

// Visual remediation contracts: progressive disclosure is an interaction, not
// deletion of underlying rules.  Class customization leads, and level selection
// focuses the relevant feature group.
const visual = renderNativeClass(rule("Visual", {
    hitDie: { number: 1, faces: 8 }, skillChoices: { count: 2, from: ["arcana", "history"] },
    progression: [
        { level: 1, featureGrants: ["class-feature.visual.alpha"], proficiencyBonus: 2,
            pactSlots: 1, pactSlotLevel: 1, invocationsElectiveTotal: 1, ordinarySpellsKnown: 2 },
        { level: 2, featureGrants: ["class-feature.visual.beta"], proficiencyBonus: 2,
            pactSlots: 2, pactSlotLevel: 1, invocationsElectiveTotal: 2, ordinarySpellsKnown: 3 }
    ],
    selectionRules: { pact: { requiredAtWarlockLevel: 1, firstChoiceFree: true } },
    separateGrants: { automaticEldritchBlast: true, mysticArcanumSeparate: true,
        pactMagicSlotsRecover: "short-or-long-rest", anotherValue: "retained" }
}), { renderValue });
const sections = nodes(visual, el => el.tagName === "SECTION" && el.className.includes("native-class-section"));
assert.ok(sections.findIndex(el => el.attrs.id === "native-class-customization")
    < sections.findIndex(el => el.attrs.id === "native-class-progression"),
    "Class-specific choices must appear ahead of detailed advancement");
assert.match(visual.textContent, /Choose 2 from Arcana, History/);
const visualThs = nodes(visual, el => el.tagName === "TH" && el.attrs.scope === "col");
assert.equal(visualThs.filter(el => !el.className.includes("native-class-extra-column")).length, 5,
    "The primary progression table should focus on level, features and no more than three other fields");
const visualGroups = nodes(visual, el => el.className === "native-class-feature-level");
assert.equal(visualGroups.length, 2);
assert.equal(visualGroups[0].tagName, "DETAILS");
assert.equal(visualGroups[0].open, true);
assert.equal(visualGroups[1].open, false);
const visualLevel = nodes(visual, el => el.tagName === "SELECT")[0];
visualLevel.value = "2";
visualLevel.dispatch("change");
assert.equal(visualGroups[0].open, false);
assert.equal(visualGroups[1].open, true);
assert.ok(visualGroups[1].classList.contains("is-selected"));
// Progression anchors reveal both containing <details> before fragment navigation.
visualGroups[0].open = false;
const visualFeature = nodes(visual, el => el.className === "native-class-feature"
    && el.attrs.id === "native-class-feature-class-feature.visual.alpha")[0];
assert.ok(visualFeature);
const progressSection = nodes(visual, el => el.tagName === "SECTION"
    && el.attrs.id === "native-class-progression")[0];
const featureLink = nodes(progressSection, el => el.tagName === "A"
    && el.attrs.href === "#native-class-feature-class-feature.visual.alpha")[0];
assert.ok(featureLink);
for (const callback of progressSection.listeners.get("click") ?? []) {
    callback({ target: { closest: () => featureLink } });
}
assert.equal(visualGroups[0].open, true);
assert.equal(visualFeature.open, true);
assert.equal(visualLevel.value, "1");
assert.ok(visualGroups[0].classList.contains("is-selected"));
const columnToggle = nodes(visual, el => el.tagName === "INPUT" &&
    el.attrs["aria-label"] === "Show all progression columns")[0];
assert.ok(columnToggle);
columnToggle.checked = true;
columnToggle.dispatch("change");
assert.equal(nodes(visual, el => el.className.includes("native-class-table-scroll")
    && el.classList.contains("is-expanded")).length, 1);
assert.match(visual.textContent, /retained/, "Unrecognized class data must remain accessible");

const manyOptions = Array.from({ length: 25 }, (_, index) => ({
    id: `class-option.visual.option-${index}`, name: `Option ${index}`
}));
const many = renderNativeClass(rule("Many", { customizationSystems: [{ name: "Many options",
    options: manyOptions }] }), { renderValue });
const showAll = nodes(many, el => el.tagName === "BUTTON" &&
    el.className === "native-class-show-all")[0];
assert.ok(showAll, "Large option sets need a compact initial view");
const manyRows = nodes(many, el => el.className === "native-class-customization-option");
assert.equal(manyRows.filter(el => !el.hidden).length, 12);
showAll.dispatch("click");
assert.equal(manyRows.filter(el => !el.hidden).length, 25);
const manySearch = nodes(many, el => el.tagName === "INPUT" && el.attrs.type === "search")[0];
manySearch.value = "option-24";
manySearch.dispatch("input");
assert.equal(manyRows.filter(el => !el.hidden).length, 1);
const eligible = renderNativeClass(rule("Eligible", { customizationSystems: [{ name: "Techniques",
    options: [
        { id: "option.eligible.general", name: "General" },
        { id: "option.eligible.blade", name: "Blade Technique" },
        { id: "option.eligible.chain", name: "Chain Technique" }
    ] }] }), { renderValue });
// Filters only appear when native prerequisites are actually documented.
assert.equal(nodes(eligible, el => el.tagName === "SELECT").length, 0);
const filteredOptions = [
    { id: "invocation.example.general", name: "General", minimumLevel: 1, requiredPact: null },
    { id: "invocation.example.blade", name: "Blade Mastery", minimumLevel: 5, requiredPact: "pact.warlock.blade" },
    { id: "invocation.example.chain", name: "Chain Mastery", minimumLevel: 7, requiredPact: "pact.warlock.chain" },
    { id: "invocation.example.novice", name: "Novice", minimumLevel: 2, requiredPact: null }
];
const filterExample = renderNativeClass(rule("FilterExample", {
    customizationSystems: [{ name: "Invocations", category: "invocation", options: filteredOptions }]
}), { renderValue });
const facetControls = nodes(filterExample, el => el.className === "native-class-option-filters")[0];
const selectors = nodes(facetControls, el => el.tagName === "SELECT");
assert.equal(selectors.length, 2, "Native prerequisites should expose level and Pact facets");
const overview = nodes(filterExample, el => el.className === "native-class-prerequisite-overview")[0];
assert.ok(overview, "Invocation references should show Pact relationships without inferring legal builds");
assert.match(overview.textContent, /Requires Blade/);
assert.match(overview.textContent, /Requires Chain/);
assert.match(filterExample.textContent, /not a character eligibility check/);
const filterRows = nodes(filterExample, el => el.className === "native-class-customization-option");
selectors[0].value = "4";
selectors[0].dispatch("change");
assert.deepEqual(filterRows.filter(el => !el.hidden).map(el => el.attrs["data-option-id"]),
    ["invocation.example.general", "invocation.example.novice"]);
selectors[0].value = "";
selectors[0].dispatch("change");
selectors[1].value = "pact.warlock.chain";
selectors[1].dispatch("change");
assert.deepEqual(filterRows.filter(el => !el.hidden).map(el => el.attrs["data-option-id"]),
    ["invocation.example.chain"]);
selectors[1].value = "none";
selectors[1].dispatch("change");
assert.equal(filterRows.filter(el => !el.hidden).length, 2);
console.log("Reference interactions: progression feature reveal, explicit preset choices, and prerequisite filters OK");
console.log("Visual remediation: compact traits, hierarchy, progression disclosure, focused feature levels, and option pagination OK");

// Future class systems must not inherit a Warlock or 5e level-20 ceiling.
const extendedClass = renderNativeClass(rule("Extended", {
    levelRange: [1, 31], progression: [{ level: 1, featureGrants: [] },
        { level: 31, featureGrants: [] }],
    customizationSystems: [{ name: "Disciplines", options: [
        { id: "discipline.extended.void", name: "Void discipline", minimumLevel: 27 }
    ] }]
}), { renderValue });
const extendedLevelFilter = nodes(extendedClass, el => el.tagName === "SELECT"
    && el.attrs["aria-label"] === "Show Disciplines options by documented class level")[0];
assert.ok(extendedLevelFilter, "The class-specific minimum level filter should be present");
assert.ok(nodes(extendedLevelFilter, el => el.tagName === "OPTION" && el.attrs.value === "31").length,
    "Available filter levels must extend to the native class level range");
extendedLevelFilter.value = "26";
extendedLevelFilter.dispatch("change");
const extendedOption = nodes(extendedClass, el => el.className === "native-class-customization-option")[0];
assert.equal(extendedOption.hidden, true, "Level 27 prerequisite must not appear at level 26");
extendedLevelFilter.value = "31";
extendedLevelFilter.dispatch("change");
assert.equal(extendedOption.hidden, false, "Level 27 prerequisite must appear at level 31");

// Transient native lookup failures should be recoverable by reopening a detail.
const retryAttempts = new Map();
const retryView = renderNativeClass(rule("Retry", {
    progression: [{ level: 1, featureGrants: ["class-feature.retry.first"] }],
    customizationSystems: [{ name: "Paths", options: ["option.retry.first"] }]
}), { renderValue, getRule: id => {
    const count = (retryAttempts.get(id) ?? 0) + 1;
    retryAttempts.set(id, count);
    return count === 1 ? Promise.reject(new Error("temporary upstream error"))
        : Promise.resolve({ rule: { id, name: "Recovered native rule",
            definition: { description: "Successfully reloaded." } } });
} });
const retryFeature = nodes(retryView, el => el.className === "native-class-feature")[0];
retryFeature.open = true;
retryFeature.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(retryFeature.textContent, /Close and reopen to retry/);
retryFeature.open = false;
retryFeature.dispatch("toggle");
retryFeature.open = true;
retryFeature.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.equal(retryAttempts.get("class-feature.retry.first"), 2,
    "Feature lookup must retry after a transient error");
assert.match(retryFeature.textContent, /Successfully reloaded/);
const retryOption = nodes(retryView, el => el.className === "native-class-customization-option-detail")[0];
retryOption.open = true;
retryOption.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(retryOption.textContent, /Close and reopen to retry/);
retryOption.open = false;
retryOption.dispatch("toggle");
retryOption.open = true;
retryOption.dispatch("toggle");
await new Promise(resolve => setImmediate(resolve));
assert.match(retryOption.textContent, /Successfully reloaded/);
assert.equal(retryAttempts.get("option.retry.first"), 2,
    "Option lookup must retry after a transient error");
console.log("Dev readiness: class-specific level range and recoverable transient API errors OK");
