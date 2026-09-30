import {
    classFamilyIdentityFields,
    classFamilyKind,
    featureGroups,
    findParentClassRelationship,
    isClassFamilyReference,
    progressionSurfaces,
    subclassesForClass
} from "../src/RulesWiki.Web/wwwroot/class-family-model.js";
import { installWikiReferenceApi } from "../src/RulesWiki.Web/wwwroot/rules-reference-api.js";
import { parseToolRoute } from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(parseToolRoute("/classes/fighter").conceptKey === "class.fighter", "Class deep links should restore stable class identity.");
assert(parseToolRoute("/subclasses/champion").conceptKey === "subclass.champion", "Subclass deep links should restore stable subclass identity.");
assert(parseToolRoute("/prestige-classes/arcane-archer").conceptKey === "prestigeClass.arcane-archer", "Prestige-class deep links should restore stable prestige-class identity.");

const classReference = {
    ruleConceptId: "class-id",
    conceptKey: "class.fighter",
    effectiveCategory: "class",
    relationships: []
};
const champion = {
    referenceIdentity: "subclass.champion",
    displayName: "Champion",
    relationships: [{
        kind: "parent-class",
        relatedRuleConceptId: "class-id",
        relatedConceptKey: "class.fighter",
        relatedEntityType: "class",
        relatedDisplayName: "Fighter"
    }]
};
const unrelatedChampion = {
    referenceIdentity: "subclass.champion-other",
    displayName: "Champion",
    relationships: [{
        kind: "parent-class",
        relatedRuleConceptId: "other-class-id",
        relatedConceptKey: "class.other",
        relatedEntityType: "class",
        relatedDisplayName: "Other"
    }]
};
assert(findParentClassRelationship(champion)?.relatedConceptKey === "class.fighter", "Subclass parent context must use Core-owned parent-class relationship metadata.");
const subclasses = subclassesForClass([champion, unrelatedChampion], classReference);
assert(subclasses.length === 1 && subclasses[0] === champion, "Subclass membership must not be inferred from same-named records.");

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
        { name: "Second Wind", level: 1 },
        { name: "Action Surge", level: 2 },
        "Source reference without explicit level"
    ]
};
const surfaces = progressionSurfaces(fiveEClass);
assert(surfaces.length === 1, "5e class table groups should become a progression surface.");
assert(surfaces[0].columns[0].label === "Level", "Class table-group row order should be presented with its class-level index.");
assert(surfaces[0].rows[1][0] === 2, "Class table-group row order should preserve level progression.");
assert(!surfaces[0].columns.some(value => value.label === "Base Attack Bonus"), "The Wiki must not manufacture progression columns that Core did not supply.");
const fiveEFeatures = featureGroups(fiveEClass, "class");
assert(fiveEFeatures.some(value => value.level === "1"), "Explicit class feature levels should group by level.");
assert(fiveEFeatures.some(value => value.level === null), "Feature references without level semantics should remain explicitly unleveled.");

const referenceApi = {
    backend: async () => ({
        reference: {
            referenceIdentity: "class.fighter",
            effectiveCategory: "class",
            effectiveVariation: { sourceEntityRevisionId: "effective" }
        },
        effectiveDocument: {
            classFeatures: ["Fighting Style|PHB|Fighter|1", "Action Surge|PHB|Fighter|2"]
        },
        effectiveAdvancementFeatures: [
            { name: "Fighting Style", level: 1, featureReference: "Fighting Style|PHB|Fighter|1" },
            { name: "Action Surge", level: 2, featureReference: "Action Surge|PHB|Fighter|2" }
        ],
        variations: [{
            category: "class",
            sourceEntityRevisionId: "effective",
            document: { classFeatures: ["Fighting Style|PHB|Fighter|1"] },
            advancementFeatures: [
                { name: "Fighting Style", level: 1, featureReference: "Fighting Style|PHB|Fighter|1" }
            ]
        }]
    })
};
installWikiReferenceApi(referenceApi);
const projectedDetail = await referenceApi.getWikiReferenceDetail("class.fighter");
const authoritativeGroups = featureGroups(projectedDetail.effectiveDocument, "class");
assert(authoritativeGroups.length === 2, "Rules Wiki should consume the authoritative Rules Core advancement-feature projection.");
assert(authoritativeGroups[0].level === "1" && authoritativeGroups[0].features[0] === "Fighting Style", "Rules Core acquisition levels should drive feature grouping.");
assert(authoritativeGroups[1].level === "2" && authoritativeGroups[1].features[0] === "Action Surge", "Rules Core acquisition levels should remain ordered by level.");
assert(!Object.keys(projectedDetail.effectiveDocument).some(key => key.includes("rulesWikiAdvancement")), "Presentation metadata must remain non-enumerable and must not alter the normalized rules document surface.");

const threeXClass = {
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
            spellcastingProfile: "dnd-3x"
        }
    }
};
const threeXFields = classFamilyIdentityFields(threeXClass, "prestigeClass");
const byLabel = new Map(threeXFields.map(value => [value.label, value.value]));
assert(byLabel.get("Maximum Level") === 10, "Older-edition maximum level should remain visible.");
assert(byLabel.get("Base Attack Progression") === "three-quarters", "Older-edition BAB progression semantics should be presented directly from Core data.");
assert(byLabel.get("Fortitude Progression") === "poor" && byLabel.get("Reflex Progression") === "good" && byLabel.get("Will Progression") === "poor", "Older-edition save progressions should remain distinct.");
assert(Array.isArray(byLabel.get("Class Skills")), "Older-edition class skills should remain structurally available.");
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
