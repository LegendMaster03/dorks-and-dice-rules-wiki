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
const threeXClass = {
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
const classFields = new Map(classFamilyIdentityFields(threeXClass, "prestigeClass")
    .map(value => [value.label, value.value]));
assert(classFields.get("Base Attack Progression") === "half", "3.x BAB progression must remain Core-owned and visible.");
assert(classFields.get("Fortitude Progression") === "poor", "3.x Fortitude progression must remain distinct.");
assert(classFields.get("Reflex Progression") === "poor", "3.x Reflex progression must remain distinct.");
assert(classFields.get("Will Progression") === "good", "3.x Will progression must remain distinct.");
assert(classFields.get("Skill Points") === 4, "3.x skillPointsPerLevel must render in the existing class workspace.");
assert(Array.isArray(classFields.get("Class Skills")), "3.x class skills must remain structurally available.");
assert(classFields.get("Spellcasting Profile") === "dnd-3x", "3.x spellcasting profile must remain visible.");
assert(explicitPrestigePrerequisites(threeXClass) === normalizedPrerequisites, "Prestige prerequisites must use normalized Core structure.");

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
}, ["INT", "Craft", "alchemy", "Ranks", "Supported", "Class-Skill State"], "3.x ranked skill");

assertRendered("background", {
    name: "Sage",
    ability: [{ int: 2 }],
    skillProficiencies: ["Arcana", "History"],
    toolProficiencies: ["Calligrapher's supplies"],
    languageProficiencies: ["Draconic"],
    feat: "Magic Initiate",
    entries: ["You spent years learning."]
}, ["Ability Scores", "Skills", "Arcana", "Feat", "Magic Initiate", "Tools", "Languages"], "5.5e background");

assertRendered("optionalfeature", {
    name: "Invocation Fixture",
    featureType: ["EI"],
    prerequisite: "5th level",
    entries: ["A class-independent feature-like rule."]
}, ["Feature Type", "Prerequisite", "5th level", "Rules"], "Option/feature");

const spellText = assertRendered("spell", {
    name: "Legacy Gate",
    level: 5,
    school: "C",
    subschool: "Teleportation",
    descriptors: ["Teleportation"],
    components: {
        v: true,
        s: true,
        m: "a silver key",
        f: "a tuned fork",
        df: true,
        xp: 100
    },
    classLevels: { Wizard: 5, Sorcerer: 5 },
    castingTime: "1 standard action",
    range: "Medium",
    targets: "One creature",
    duration: "1 round/level",
    savingThrow: "Will negates",
    spellResistance: "Yes",
    entries: ["You open a temporary gate."],
    legacyMystery: "Preserved legacy mechanic",
    _rulesCore: {
        pcgen: {
            unmappedSegments: [{ tag: "CLASSES", value: "Wizard=5|Sorcerer=5" }]
        }
    }
}, [
    "Subschool", "Teleportation", "Descriptors", "Class-Dependent Levels",
    "Material Components", "silver key", "Focus", "tuned fork", "Divine Focus",
    "XP Cost", "100", "Targets", "Will negates", "Spell Resistance", "Yes",
    "Source-Specific Mechanics", "CLASSES", "Wizard=5|Sorcerer=5", "Preserved legacy mechanic"
], "3.x spell");
assert(!spellText.includes("Class-Dependent Levels[object Object]"), "3.x class-dependent spell levels must remain structured.");

assertRendered("item", {
    name: "Legacy Blade",
    type: "weapon",
    enhancementBonus: 2,
    charges: 3,
    value: 1200,
    weight: 4,
    specialProperties: ["Keen"],
    legacyProperty: "Edition-native item mechanic",
    entries: ["A 3.x weapon fixture."]
}, ["Weight", "4 lb.", "Value", "12 gp", "Enhancement Bonus", "2", "Charges", "3", "Edition-native item mechanic"], "3.x item");

assertRendered("species", {
    name: "Legacy Race",
    size: ["M"],
    speed: 30,
    ability: [{ dex: 2, con: -2 }],
    entries: [{ name: "Legacy Trait", entries: ["A source-native older-edition trait."] }],
    _rulesCore: {
        pcgen: {
            unmappedSegments: [{ tag: "RACESUBTYPE", value: "Elf" }]
        }
    }
}, ["Medium", "30 ft.", "DEX +2", "CON -2", "Legacy Trait", "Source-Specific Mechanics", "RACESUBTYPE"], "3.x race/species");

const unknownRendered = renderResolvedRule("unknownMechanicalFamily", {
    name: "Unknown Fixture",
    entries: ["Known prose remains readable."],
    unmodeledMechanic: "Preserve this value"
}, { showDocument: false });
assert(unknownRendered.textContent.includes("Preserve this value"), "Specialization must not hide unknown supplied fields.");

const referenceApiSource = readFileSync(
    new URL("../src/RulesWiki.Web/wwwroot/rules-reference-api.js", import.meta.url),
    "utf8");
assert(referenceApiSource.includes("/api/wiki/references"), "Rules Wiki reference reads must remain on the private Wiki contract.");
assert(referenceApiSource.includes("/api/wiki/references/comparison"), "The Core-owned semantic comparison entry point must remain available.");
assert(!referenceApiSource.includes("/api/resolved-rules"), "Phase 4 must not add a public resolved-rules dependency to the Wiki reference API.");

console.log("Phase 4 cross-edition reference validation passed.");
