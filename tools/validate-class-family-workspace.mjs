import {
    classFamilyIdentityFields,
    classFamilyKind,
    explicitPrestigePrerequisites,
    featureGroups,
    isClassFamilyReference,
    progressionSurfaces
} from "../src/RulesWiki.Web/wwwroot/class-family-model.js";
import { installWikiReferenceApi } from "../src/RulesWiki.Web/wwwroot/rules-reference-api.js";
import { parseToolRoute } from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(parseToolRoute("/classes/fighter").conceptKey === "class.fighter", "Class deep links should restore stable class identity.");
assert(parseToolRoute("/subclasses/champion").conceptKey === "subclass.champion", "Subclass deep links should restore stable subclass identity.");
assert(parseToolRoute("/prestige-classes/arcane-archer").conceptKey === "prestigeClass.arcane-archer", "Prestige-class deep links should restore stable prestige-class identity.");

const fiveEClass = {
    hd: { number: 1, faces: 10 },
    primaryAbility: ["str", "dex"],
    proficiency: ["str", "con"],
    startingProficiencies: {
        armor: ["Light", "Medium", "Heavy"],
        weapons: ["Simple", "Martial"],
        tools: ["Smith's tools"],
        skills: { choose: 2, from: ["Acrobatics", "Athletics"] }
    },
    classTableGroups: [{
        title: "Core",
        colLabels: ["Proficiency Bonus", "Features"],
        rows: [
            ["+2", ["Fighting Style", "Second Wind"]],
            ["+2", ["Action Surge"]]
        ]
    }],
    classFeatures: [
        "Fighting Style|Fighter|PHB|1",
        "Action Surge|Fighter|PHB|2",
        "Source reference without authoritative acquisition metadata"
    ],
    _rulesCore: {
        character: {
            advancementFeatures: [
                { name: "Fighting Style", level: 1, featureReference: "Fighting Style|Fighter|PHB|1" },
                { name: "Action Surge", level: 2, featureReference: "Action Surge|Fighter|PHB|2" }
            ]
        }
    }
};
const surfaces = progressionSurfaces(fiveEClass);
assert(surfaces.length === 1, "5e class table groups should become a progression surface.");
assert(surfaces[0].columns[0].label === "Level", "Class table-group row order should be presented with its class-level index.");
assert(surfaces[0].rows[1][0] === 2, "Class table-group row order should preserve level progression.");
assert(!surfaces[0].columns.some(value => value.label === "Base Attack Bonus"), "The Wiki must not manufacture progression columns that Core did not supply.");
const fiveEFeatures = featureGroups(fiveEClass, "class");
assert(fiveEFeatures.length === 2, "Rules Core advancementFeatures should drive class feature grouping.");
assert(fiveEFeatures[0].level === "1" && fiveEFeatures[0].features[0] === "Fighting Style", "Authoritative acquisition level 1 should be preserved.");
assert(fiveEFeatures[1].level === "2" && fiveEFeatures[1].features[0] === "Action Surge", "Authoritative acquisition level 2 should be preserved.");

const rawOnlyFeatures = featureGroups({
    classFeatures: [
        "Fighting Style|Fighter|PHB|1",
        "Action Surge|Fighter|PHB|2"
    ]
}, "class");
assert(rawOnlyFeatures.length === 1, "Raw source feature references should remain present when no normalized acquisition metadata exists.");
assert(rawOnlyFeatures[0].level === null, "Rules Wiki must not infer acquisition levels from encoded source feature references.");

const requests = [];
const realContractDetail = {
    reference: {
        referenceIdentity: "canonical:class-fixture",
        effectiveCategory: "class",
        effectiveVariation: { sourceEntityRevisionId: "effective" }
    },
    effectiveDocument: structuredClone(fiveEClass),
    variations: [{
        category: "class",
        sourceEntityRevisionId: "effective",
        document: structuredClone(fiveEClass)
    }]
};
const relationContract = {
    scope: "global",
    campaignId: null,
    referenceIdentity: "canonical:class-fixture",
    parentClasses: [],
    subclasses: [{
        referenceIdentity: "canonical:subclass-fixture",
        ruleConceptId: null,
        conceptKey: null,
        displayName: "Fixture Subclass",
        entityType: "subclass",
        browserLink: {
            toolSlug: "rules-core",
            toolRelativePath: "/references/canonical%3Asubclass-fixture",
            conceptKey: "canonical:subclass-fixture"
        }
    }]
};
const referenceApi = {
    backend: async path => {
        requests.push(path);
        return path.endsWith("/class-family") ? relationContract : realContractDetail;
    }
};
installWikiReferenceApi(referenceApi);
const projectedDetail = await referenceApi.getWikiReferenceDetail("canonical:class-fixture");
assert(projectedDetail === realContractDetail, "Wiki reference detail should consume the production Core contract without inventing presentation-only API properties.");
assert(!("effectiveAdvancementFeatures" in projectedDetail), "The Phase 3 validator must not invent effectiveAdvancementFeatures.");
assert(!("advancementFeatures" in projectedDetail.variations[0]), "The Phase 3 validator must not invent variation.advancementFeatures.");
assert(JSON.stringify(projectedDetail.effectiveDocument) === JSON.stringify(fiveEClass), "Rules Wiki must not mutate normalized rules semantics while presenting acquisition levels.");
const projectedGroups = featureGroups(projectedDetail.effectiveDocument, "class");
assert(projectedGroups[0].level === "1" && projectedGroups[1].level === "2", "Production document advancement metadata should remain authoritative after API projection.");

const relations = await referenceApi.getClassFamilyRelations("canonical:class-fixture");
assert(relations.subclasses.length === 1 && relations.subclasses[0].referenceIdentity === "canonical:subclass-fixture", "Class-family navigation should consume the Core-owned related-reference collection.");
assert(requests.some(path => path.endsWith("/wiki/references/canonical%3Aclass-fixture/class-family")), "Class-family context should use the direct Core relationship endpoint rather than a subclass catalog scan.");

const threeXPrerequisites = {
    kind: "all",
    entries: [
        { kind: "baseAttackBonus", value: 5 },
        { kind: "skill", name: "Knowledge (arcana)", ranks: 8 }
    ]
};
const threeXClass = {
    prerequisite: "Legacy source fallback should not replace normalized data",
    _rulesCore: {
        character: {
            maximumLevel: 10,
            baseAttackProgression: "three-quarters",
            saveProgressions: {
                fortitude: "poor",
                reflex: "good",
                will: "poor"
            },
            startingSkillPoints: 4,
            classSkills: ["Climb", "Jump", "Craft"],
            spellcastingProfile: "dnd-3x",
            prerequisites: threeXPrerequisites,
            advancementFeatures: [
                { name: "Prestige Feature", level: 1 }
            ]
        }
    }
};
const threeXFields = classFamilyIdentityFields(threeXClass, "prestigeClass");
const byLabel = new Map(threeXFields.map(value => [value.label, value.value]));
assert(byLabel.get("Maximum Level") === 10, "Older-edition maximum level should remain visible.");
assert(byLabel.get("Base Attack Progression") === "three-quarters", "Older-edition BAB progression semantics should be presented directly from Core data.");
assert(byLabel.get("Fortitude Progression") === "poor" && byLabel.get("Reflex Progression") === "good" && byLabel.get("Will Progression") === "poor", "Older-edition save progressions should remain distinct.");
assert(Array.isArray(byLabel.get("Class Skills")), "Older-edition class skills should remain structurally available.");
assert(byLabel.get("Prerequisites") === threeXPrerequisites, "Prestige-class summary should prefer normalized Rules Core prerequisites.");
assert(explicitPrestigePrerequisites(threeXClass) === threeXPrerequisites, "Structured normalized prestige prerequisites should be preserved without reinterpretation.");
assert(featureGroups(threeXClass, "prestigeClass")[0].level === "1", "Older-edition authoritative feature acquisition levels should remain available.");
assert(classFamilyKind("prestigeClass") === "prestigeClass", "Prestige classes must retain a distinct class-family kind.");

const crossCategory = {
    reference: {
        entityType: "subclass",
        effectiveCategory: "subclass",
        categoryHistory: [{ category: "prestigeClass", editions: ["3.5e"] }]
    },
    variations: [{ category: "subclass" }, { category: "prestigeClass" }]
};
assert(isClassFamilyReference(crossCategory), "Cross-category class-family history should stay in the specialized workspace.");

console.log("Class-family Phase 3 model validation passed.");
