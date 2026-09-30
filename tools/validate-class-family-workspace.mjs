import {
    classFamilyIdentityFields,
    classFamilyKind,
    explicitPrestigePrerequisites,
    featureGroups,
    isClassFamilyReference,
    progressionSurfaces,
    registerClassFamilyAdvancementMetadata
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
    ]
};
const fiveEAdvancement = [
    { name: "Fighting Style", level: 1, featureReference: "Fighting Style|Fighter|PHB|1" },
    { name: "Action Surge", level: 2, featureReference: "Action Surge|Fighter|PHB|2" },
    { name: "Source reference without authoritative acquisition metadata", level: null, featureReference: "Source reference without authoritative acquisition metadata" }
];
const surfaces = progressionSurfaces(fiveEClass);
assert(surfaces.length === 1, "5e class table groups should become a progression surface.");
assert(surfaces[0].columns[0].label === "Level", "Class table-group row order should be presented with its class-level index.");
assert(surfaces[0].rows[1][0] === 2, "Class table-group row order should preserve level progression.");
assert(!surfaces[0].columns.some(value => value.label === "Base Attack Bonus"), "The Wiki must not manufacture progression columns that Core did not supply.");

const rawOnlyFeatures = featureGroups({
    classFeatures: [
        "Fighting Style|Fighter|PHB|1",
        "Action Surge|Fighter|PHB|2"
    ]
}, "class");
assert(rawOnlyFeatures.length === 1, "Raw source feature references should remain present when no authoritative acquisition metadata exists.");
assert(rawOnlyFeatures[0].level === null, "Rules Wiki must not infer acquisition levels from encoded source feature references.");

const requests = [];
const effectiveDocument = structuredClone(fiveEClass);
const variationDocument = structuredClone(fiveEClass);
const effectiveDocumentBefore = JSON.stringify(effectiveDocument);
const variationDocumentBefore = JSON.stringify(variationDocument);
const realContractDetail = {
    reference: {
        referenceIdentity: "canonical:class-fixture",
        effectiveCategory: "class",
        effectiveVariation: { sourceEntityRevisionId: "effective" }
    },
    effectiveDocument,
    effectiveAdvancementFeatures: structuredClone(fiveEAdvancement),
    variations: [{
        category: "class",
        sourceEntityRevisionId: "effective",
        document: variationDocument,
        advancementFeatures: structuredClone(fiveEAdvancement)
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
assert(projectedDetail === realContractDetail, "Wiki reference detail should preserve the production Core response object.");
assert(Array.isArray(projectedDetail.effectiveAdvancementFeatures), "The production contract should expose effectiveAdvancementFeatures.");
assert(Array.isArray(projectedDetail.variations[0].advancementFeatures), "Each source variation should expose advancementFeatures.");
const projectedGroups = featureGroups(projectedDetail.effectiveDocument, "class");
assert(projectedGroups.length === 3, "Effective Core advancement metadata should drive leveled and unresolved feature grouping.");
assert(projectedGroups[0].level === "1" && projectedGroups[0].features[0] === "Fighting Style", "Effective acquisition level 1 should be preserved.");
assert(projectedGroups[1].level === "2" && projectedGroups[1].features[0] === "Action Surge", "Effective acquisition level 2 should be preserved.");
assert(projectedGroups[2].level === null && projectedGroups[2].features[0] === "Source reference without authoritative acquisition metadata", "Unresolved Core acquisition metadata should remain unresolved.");
const variationGroups = featureGroups(projectedDetail.variations[0].document, "class");
assert(variationGroups[0].level === "1" && variationGroups[1].level === "2", "Variation advancementFeatures should drive inspected source grouping.");
assert(JSON.stringify(projectedDetail.effectiveDocument) === effectiveDocumentBefore, "Registering effective advancement metadata must not mutate the normalized rule document.");
assert(JSON.stringify(projectedDetail.variations[0].document) === variationDocumentBefore, "Registering variation advancement metadata must not mutate the normalized source document.");

const precedenceDocument = {
    classFeatures: ["Raw Feature|Fixture|SRC|1"],
    _rulesCore: {
        character: {
            advancementFeatures: [{ name: "Normalized Fallback", level: 9 }]
        }
    }
};
registerClassFamilyAdvancementMetadata({
    effectiveDocument: precedenceDocument,
    effectiveAdvancementFeatures: [{ name: "Explicit Wiki Contract", level: 2 }],
    variations: []
});
const precedenceGroups = featureGroups(precedenceDocument, "class");
assert(precedenceGroups.length === 1 && precedenceGroups[0].level === "2" && precedenceGroups[0].features[0] === "Explicit Wiki Contract", "Explicit Wiki advancement metadata must take precedence over normalized document fallback metadata.");

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
assert(featureGroups(threeXClass, "prestigeClass")[0].level === "1", "Older-edition normalized advancementFeatures should remain available as the document fallback path.");
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
