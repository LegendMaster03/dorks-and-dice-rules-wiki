import { readFileSync } from "node:fs";
import {
    getBrowserFilterDefinitions,
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    classFamilyIdentityFields,
    explicitPrestigePrerequisites
} from "../src/RulesWiki.Web/wwwroot/class-family-model.js";

class FakeNode {
    constructor(tagName = "", text = "") {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.attributes = new Map();
        this.dataset = {};
        this.className = "";
        this._text = String(text ?? "");
        this.classList = {
            contains: value => this.className.split(/\s+/).filter(Boolean).includes(value),
            add: value => {
                const values = new Set(this.className.split(/\s+/).filter(Boolean));
                values.add(value);
                this.className = [...values].join(" ");
            }
        };
    }

    append(...nodes) {
        for (const node of nodes) {
            if (node === null || node === undefined) continue;
            this.children.push(node);
        }
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._text = "";
        this.append(...nodes);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    addEventListener() {}

    querySelector(selector) {
        if (!selector.startsWith(".")) return null;
        const className = selector.slice(1);
        for (const child of this.children) {
            if (!(child instanceof FakeNode)) continue;
            if (child.classList.contains(className)) return child;
            const nested = child.querySelector(selector);
            if (nested) return nested;
        }
        return null;
    }

    set textContent(value) {
        this._text = String(value ?? "");
        this.children = [];
    }

    get textContent() {
        return this._text
            + this.children.map(child => child?.textContent ?? String(child ?? "")).join("");
    }
}

globalThis.Node = FakeNode;
globalThis.document = {
    createElement: tagName => new FakeNode(tagName),
    createTextNode: text => new FakeNode("#text", text)
};

const { renderResolvedRule } = await import("../src/RulesWiki.Web/wwwroot/rule-renderers.js");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function filterKeys(entityType) {
    return new Set(getBrowserFilterDefinitions(entityType).map(value => value.key));
}

function columnKeys(entityType) {
    return new Set(getEntityBrowserConfig(entityType).columns.map(value => value.key));
}

function assertIncludesAll(actual, expected, context) {
    for (const value of expected) {
        assert(actual.has(value), `${context} must include '${value}'.`);
    }
}

function assertRendered(type, document, required, context = type) {
    const rendered = renderResolvedRule(type, document, { showDocument: false });
    assert(rendered.classList.contains("rules-core-structured-rule"), `${context} should use structured presentation.`);
    const text = rendered.textContent;
    for (const value of required) {
        assert(text.toLowerCase().includes(value.toLowerCase()), `${context} omitted '${value}'. Rendered text: ${text}`);
    }
    assert(!text.includes("[object Object]"), `${context} leaked structured mechanics as [object Object].`);
    return text;
}

const targetFamilies = [
    "species", "subspecies", "background", "feat", "optionalfeature",
    "skill", "spell", "item", "condition", "rule"
];
for (const family of targetFamilies) {
    const filters = filterKeys(family);
    assertIncludesAll(filters, ["sourceCode", "package", "edition"], `${family} shared filters`);
}

assertIncludesAll(columnKeys("spell"), ["name", "level", "school", "source"], "Spell columns");
assertIncludesAll(filterKeys("spell"), [
    "level", "school", "castingTime", "range", "components", "concentration", "ritual",
    "spellList", "subschool", "descriptors"
], "Spell filters");
assertIncludesAll(columnKeys("background"), ["name", "skills", "feat", "source"], "Background columns");
assertIncludesAll(filterKeys("background"), ["ability", "skills", "feat"], "Background filters");
assertIncludesAll(columnKeys("optionalfeature"), ["name", "featureType", "source"], "Option/feature columns");
assertIncludesAll(filterKeys("optionalfeature"), ["featureType", "prerequisite"], "Option/feature filters");
assertIncludesAll(filterKeys("species"), ["size", "ability", "creatureType"], "Species filters");
assertIncludesAll(filterKeys("feat"), ["category", "prerequisite", "repeatable"], "Feat filters");
assertIncludesAll(filterKeys("item"), ["type", "rarity", "attunement", "weaponCategory", "properties"], "Item filters");
assertIncludesAll(columnKeys("skill"), ["name", "ability", "family", "source"], "Skill columns");
assertIncludesAll(filterKeys("skill"), ["ability", "family", "ranks", "trainedOnly", "armorCheckPenalty"], "Skill filters");

assert(getEntityBrowserConfigForRoute("races")?.entityType === "species", "Legacy Race routes must retain Species compatibility.");
assert(getEntityBrowserConfigForRoute("subraces")?.entityType === "subspecies", "Legacy Subrace routes must retain Subspecies compatibility.");
assert(getEntityBrowserConfig("unknownMechanicalFamily").renderer === "generic", "Unknown families must retain the generic fallback renderer.");

const normalizedPrerequisites = [{
    matchCount: 1,
    requirements: [{ kind: "skill-ranks", targetName: "Spellcraft", operator: ">=", value: 8 }]
}];
const canonicalClass = {
    hd: { number: 1, faces: 6 },
    _rulesCore: {
        character: {
            maximumLevel: 10,
            baseAttackProgression: "half",
            saveProgressions: { fortitude: "poor", reflex: "poor", will: "good" },
            skillPointsPerLevel: 4,
            classSkills: ["Concentration", "Knowledge (arcana)", "Spellcraft"],
            spellcastingProfile: "dnd-3x",
            prerequisites: normalizedPrerequisites
        }
    }
};
const classFields = new Map(classFamilyIdentityFields(canonicalClass, "prestigeClass")
    .map(value => [value.label, value.value]));
assert(classFields.get("Base Attack Progression") === "half", "Canonical BAB progression must remain Core-owned and visible.");
assert(classFields.get("Fortitude Progression") === "poor", "Canonical Fortitude progression must remain distinct.");
assert(classFields.get("Reflex Progression") === "poor", "Canonical Reflex progression must remain distinct.");
assert(classFields.get("Will Progression") === "good", "Canonical Will progression must remain distinct.");
assert(classFields.get("Skill Points") === 4, "Canonical skillPointsPerLevel must render in the class workspace.");
assert(Array.isArray(classFields.get("Class Skills")), "Canonical class skills must remain structurally available.");
assert(classFields.get("Spellcasting Profile") === "dnd-3x", "Canonical spellcasting profile must remain visible.");
assert(explicitPrestigePrerequisites(canonicalClass) === normalizedPrerequisites, "Prestige prerequisites must use normalized Core structure.");

assertRendered("skill", {
    name: "Craft (alchemy)",
    entries: ["Use this skill to create alchemical items."],
    _rulesCore: {
        competency: {
            familyName: "Craft",
            specialty: "alchemy",
            governingAbilityKey: "intelligence",
            supportsRanks: true,
            supportsClassSkillState: true,
            supportsTrainingState: true,
            trainedOnly: false,
            armorCheckPenaltyApplies: false
        }
    }
}, ["INT", "Craft", "alchemy", "Ranks", "Supported", "Class-Skill State"], "canonical ranked skill");

assertRendered("feat", {
    name: "Arcane Qualification",
    category: "General",
    repeatable: false,
    entries: ["A canonical feat fixture."],
    _rulesCore: {
        character: { prerequisites: normalizedPrerequisites }
    }
}, ["General", "Prerequisite", "Spellcraft", "8"], "canonical feat prerequisite");

assertRendered("background", {
    name: "Sage",
    ability: [{ int: 2 }],
    skillProficiencies: ["Arcana", "History"],
    toolProficiencies: ["Calligrapher's supplies"],
    languageProficiencies: ["Draconic"],
    feat: "Magic Initiate",
    entries: ["You spent years learning."]
}, ["Ability Scores", "Skills", "Arcana", "Feat", "Magic Initiate", "Tools", "Languages"], "background");

assertRendered("optionalfeature", {
    name: "Invocation Fixture",
    featureType: ["Eldritch Invocation"],
    prerequisite: "5th level",
    entries: ["A class-independent feature-like rule."]
}, ["Feature Type", "Prerequisite", "5th level", "Rules"], "option/feature");

const modernSpellText = assertRendered("spell", {
    name: "Modern Ward",
    level: 2,
    school: "Abjuration",
    time: "1 action",
    range: "Touch",
    components: { v: true, s: true },
    duration: "1 hour",
    entries: ["A modern canonical spell fixture."]
}, ["2nd level", "Abjuration", "1 action", "Touch", "V, S"], "modern canonical spell");
assert(!modernSpellText.includes("Subschool"), "Omitted older-edition spell fields must not create bogus values.");
assert(!modernSpellText.includes("Spell Resistance"), "Omitted older-edition spell fields must not create bogus values.");

const olderSpellText = assertRendered("spell", {
    name: "Legacy Gate",
    level: 5,
    school: "Conjuration",
    time: "1 standard action",
    range: "Medium",
    components: { v: true, s: true },
    duration: "1 round/level",
    subschool: "Teleportation",
    descriptors: ["Teleportation"],
    spellLists: ["Wizard", "Sorcerer"],
    classLevels: { Wizard: 5, Sorcerer: 5 },
    materialComponents: "a silver key",
    focus: "a tuned fork",
    divineFocus: true,
    xpCost: 100,
    targets: "One creature",
    savingThrow: "Will negates",
    spellResistance: "Yes",
    entries: ["You open a temporary gate."],
    canonicalFutureMechanic: "Preserved canonical extension"
}, [
    "Subschool", "Teleportation", "Descriptors", "Class-Dependent Levels",
    "Material Components", "silver key", "Focus", "tuned fork", "Divine Focus",
    "XP Cost", "100", "Targets", "Will negates", "Spell Resistance", "Yes"
], "older-edition canonical spell");
assert(!olderSpellText.includes("[object Object]"), "Class-dependent spell levels must remain structured.");

assertRendered("item", {
    name: "Legacy Blade",
    type: "Weapon",
    enhancementBonus: 2,
    charges: 3,
    value: 1200,
    weight: 4,
    specialProperties: ["Keen"],
    entries: ["An older-edition canonical item fixture."]
}, ["Weight", "4 lb.", "Value", "12 gp", "Enhancement Bonus", "2", "Charges", "3", "Keen"], "canonical item");

assertRendered("species", {
    name: "Evidence Fixture",
    size: ["M"],
    speed: 30,
    ability: [{ dex: 2, con: -2 }],
    entries: [{ name: "Trait", entries: ["A normalized trait."] }],
    _rulesCore: {
        pcgen: {
            unmappedSegments: [{ tag: "RACESUBTYPE", value: "Elf" }]
        }
    }
}, ["Medium", "30 ft.", "Trait", "Source-Specific Mechanics", "RACESUBTYPE"], "source evidence presentation");

const unknownRendered = renderResolvedRule("unknownMechanicalFamily", {
    name: "Unknown Fixture",
    entries: ["Known prose remains readable."],
    unmodeledMechanic: "Preserve this value"
}, { showDocument: false });
assert(unknownRendered.textContent.includes("Preserve this value"), "Unknown canonical fields must remain visible.");

const phase4RendererSource = readFileSync(
    new URL("../src/RulesWiki.Web/wwwroot/phase4-reference-renderers.js", import.meta.url),
    "utf8");
for (const forbidden of ["threeXField", "_rulesCore?.threeX", "legacy-srd", "pcgen?.unmappedSegments", "RD|XDMG"]) {
    assert(!phase4RendererSource.includes(forbidden), `Phase 4 renderer must not contain source-format compatibility token '${forbidden}'.`);
}

const referenceApiSource = readFileSync(
    new URL("../src/RulesWiki.Web/wwwroot/rules-reference-api.js", import.meta.url),
    "utf8");
assert(referenceApiSource.includes("/api/wiki/references"), "Rules Wiki reference reads must remain on the private Wiki contract.");
assert(referenceApiSource.includes("/api/wiki/references/comparison"), "The Core-owned semantic comparison entry point must remain available.");
assert(!referenceApiSource.includes("/api/resolved-rules"), "Phase 4 must not add a public resolved-rules dependency to the Wiki reference API.");

console.log("Phase 4 canonical reference validation passed.");
