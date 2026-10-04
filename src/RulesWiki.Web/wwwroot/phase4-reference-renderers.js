import { codeBlock, element } from "./ui.js";
import {
    PRESENTATION_METADATA_FIELDS,
    formatDetailValue,
    hasSectionContent,
    hasValue,
    renderAdditionalMechanics,
    renderCompactStatistic,
    renderRuleContent,
    renderRulesCoreExtensions,
    renderRulesTextSection,
    titleCase
} from "./rule-renderer-support.js";
import {
    renderItem as renderBaseItem,
    renderSpell as renderBaseSpell
} from "./rule-renderers-specialized.js";

const SPELL_EDITION_FIELDS = Object.freeze([
    "subschool",
    "descriptors",
    "spellLists",
    "classLevels",
    "materialComponents",
    "focus",
    "divineFocus",
    "xpCost",
    "targets",
    "area",
    "effect",
    "savingThrow",
    "spellResistance"
]);

export function renderGenericReference(document = {}, options = {}) {
    const entries = firstSemanticValue(document?.entries, document?.rules, document?.text);
    return renderReferenceRule(document, options, {
        sections: [["Rules", entries]],
        consumed: ["entries", "rules", "text"]
    });
}

export function renderBackground(document = {}, options = {}) {
    return renderReferenceRule(document, options, {
        summary: [
            ["Ability Scores", formatDetailValue(document?.ability)],
            ["Skills", formatProficiencySelection(document?.skillProficiencies)],
            ["Feat", formatDetailValue(firstSemanticValue(document?.feats, document?.feat))]
        ],
        details: [
            ["Tools", formatProficiencySelection(document?.toolProficiencies)],
            ["Languages", formatProficiencySelection(document?.languageProficiencies)]
        ],
        sections: [["Rules", document?.entries]],
        consumed: [
            "ability", "skillProficiencies", "feats", "feat",
            "toolProficiencies", "languageProficiencies", "entries"
        ]
    });
}

export function renderOptionalFeature(document = {}, options = {}) {
    return renderReferenceRule(document, options, {
        summary: [
            ["Feature Type", formatFeatureTypes(firstSemanticValue(document?.featureType, document?.type))]
        ],
        details: [
            ["Prerequisite", formatDetailValue(firstSemanticValue(document?.prerequisite, document?.prerequisites))]
        ],
        sections: [["Rules", document?.entries]],
        consumed: ["featureType", "type", "prerequisite", "prerequisites", "entries"]
    });
}

export function renderCrossEditionSkill(document = {}, options = {}) {
    const competency = normalizedCompetency(document);
    const presentationDocument = {
        ...document,
        _rulesCore: omitRulesCoreProperties(document?._rulesCore, "competency", [
            "governingAbilityKey",
            "familyName",
            "specialty",
            "supportsRanks",
            "supportsClassSkillState",
            "supportsTrainingState",
            "trainedOnly",
            "armorCheckPenaltyApplies"
        ])
    };

    return renderReferenceRule(presentationDocument, options, {
        summary: [
            ["Ability", formatAbility(competency?.governingAbilityKey)],
            ["Family", competency?.familyName],
            ["Specialty", competency?.specialty]
        ],
        details: [
            ["Ranks", formatSupport(competency?.supportsRanks)],
            ["Class-Skill State", formatSupport(competency?.supportsClassSkillState)],
            ["Training State", formatSupport(competency?.supportsTrainingState)],
            ["Trained Only", formatBoolean(competency?.trainedOnly)],
            ["Armor Check Penalty", formatBoolean(competency?.armorCheckPenaltyApplies)]
        ],
        sections: [["Rules", document?.entries]],
        consumed: ["entries"]
    });
}

export function renderCrossEditionFeat(document = {}, options = {}) {
    const character = normalizedCharacter(document);
    const epic = normalizedEpic(document);
    const presentationDocument = {
        ...document,
        _rulesCore: omitRulesCoreProperties(
            omitRulesCoreProperties(document?._rulesCore, "character", ["prerequisites"]),
            "epic",
            ["canonicalTerm"])
    };

    return renderReferenceRule(presentationDocument, options, {
        summary: [
            ["Category", firstSemanticValue(epic?.canonicalTerm, document?.category)],
            ["Repeatable", formatBoolean(document?.repeatable)]
        ],
        details: [
            ["Prerequisite", character?.prerequisites]
        ],
        sections: [["Rules", document?.entries]],
        consumed: ["category", "repeatable", "entries"]
    });
}

export function renderCrossEditionSpell(document = {}, options = {}) {
    const baseDocument = omitTopLevel(document, SPELL_EDITION_FIELDS);
    const root = renderBaseSpell(baseDocument, { ...options, showDocument: false });

    appendLabeledSection(root, "3.x Spell Mechanics", [
        ["Subschool", document?.subschool],
        ["Descriptors", document?.descriptors],
        ["Class / List Access", document?.spellLists],
        ["Class-Dependent Levels", document?.classLevels],
        ["Material Components", document?.materialComponents],
        ["Focus", document?.focus],
        ["Divine Focus", document?.divineFocus],
        ["XP Cost", document?.xpCost],
        ["Targets", document?.targets],
        ["Area", document?.area],
        ["Effect", document?.effect],
        ["Saving Throw", document?.savingThrow],
        ["Spell Resistance", document?.spellResistance]
    ]);

    if (options.showDocument !== false) appendDocumentDisclosure(root, document, options.documentLabel);
    return root;
}

export function renderCrossEditionItem(document = {}, options = {}) {
    return renderBaseItem(document, options);
}

function renderReferenceRule(
    document = {},
    options = {},
    { summary = [], details = [], sections = [], consumed = [] } = {})
{
    const root = element("article", {
        className: "rules-core-rule-renderer rules-core-structured-rule"
    });
    const consumedKeys = new Set(["name", "_rulesCore", ...consumed]);

    const visibleSummary = summary.filter(([, value]) => hasValue(value));
    if (visibleSummary.length) {
        root.append(element("section", { className: "rules-core-rule-summary" },
            visibleSummary.map(([label, value]) => renderCompactStatistic(label, value))));
    }

    appendLabeledSection(root, null, details);

    for (const [title, value] of sections) {
        if (hasSectionContent(value)) root.append(renderRulesTextSection(title, value));
    }

    root.append(...renderRulesCoreExtensions(document?._rulesCore));

    const extras = Object.entries(document ?? {})
        .filter(([key, value]) => !consumedKeys.has(key)
            && !PRESENTATION_METADATA_FIELDS.has(key)
            && !key.startsWith("_")
            && hasValue(value));
    if (extras.length) root.append(renderAdditionalMechanics(extras));

    if (options.showDocument !== false) appendDocumentDisclosure(root, document, options.documentLabel);
    return root;
}

function appendLabeledSection(root, title, items) {
    const visible = items.filter(([, value]) => hasValue(value));
    if (!visible.length) return;
    const section = element("section", {
        className: "rules-core-structured-section rules-core-structured-details"
    });
    if (title) {
        section.append(element("h4", {
            className: "rules-core-structured-section-title",
            text: title
        }));
    }
    const list = element("dl", { className: "rules-core-labeled-details" });
    for (const [label, value] of visible) {
        list.append(
            element("dt", { text: label }),
            element("dd", {}, renderRuleContent(value)));
    }
    section.append(list);
    root.append(section);
}

function appendDocumentDisclosure(root, document, label) {
    const raw = element("details", { className: "rules-core-secondary-details" });
    raw.append(
        element("summary", { text: label ?? "Normalized rule document" }),
        element("div", { className: "rules-core-secondary-details-body" }, codeBlock(document)));
    root.append(raw);
}

function normalizedCompetency(document) {
    const competency = document?._rulesCore?.competency;
    return competency && typeof competency === "object" && !Array.isArray(competency)
        ? competency
        : null;
}

function normalizedCharacter(document) {
    const character = document?._rulesCore?.character;
    return character && typeof character === "object" && !Array.isArray(character)
        ? character
        : null;
}

function normalizedEpic(document) {
    const epic = document?._rulesCore?.epic;
    return epic && typeof epic === "object" && !Array.isArray(epic)
        ? epic
        : null;
}

function omitRulesCoreProperties(extension, sectionName, propertyNames) {
    if (!extension || typeof extension !== "object" || Array.isArray(extension)) return extension;
    const section = extension[sectionName];
    if (!section || typeof section !== "object" || Array.isArray(section)) return extension;

    const omitted = new Set(propertyNames ?? []);
    const remainingSection = Object.fromEntries(
        Object.entries(section).filter(([key, value]) => !omitted.has(key) && hasValue(value)));
    const result = { ...extension };
    if (Object.keys(remainingSection).length) result[sectionName] = remainingSection;
    else delete result[sectionName];
    return Object.keys(result).length ? result : null;
}

function omitTopLevel(value, names) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const omitted = new Set(names ?? []);
    return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function formatAbility(value) {
    if (!hasValue(value)) return null;
    if (typeof value !== "string") return formatDetailValue(value);
    const normalized = value.trim().toLowerCase();
    return ({
        strength: "STR", dexterity: "DEX", constitution: "CON",
        intelligence: "INT", wisdom: "WIS", charisma: "CHA"
    })[normalized] ?? value.toUpperCase();
}

function formatSupport(value) {
    if (value === true) return "Supported";
    if (value === false) return "Not supported";
    return null;
}

function formatBoolean(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return null;
}

function formatFeatureTypes(value) {
    if (!hasValue(value)) return null;
    const values = Array.isArray(value) ? value : [value];
    return values.map(entry => titleCase(String(entry))).join(", ");
}

function formatProficiencySelection(value) {
    if (!hasValue(value)) return null;
    if (!Array.isArray(value)) return formatDetailValue(value);
    const formatted = value.map(entry => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return formatDetailValue(entry);
        }
        const direct = Object.entries(entry)
            .filter(([, selected]) => selected === true)
            .map(([name]) => titleCase(name));
        if (direct.length) return direct.join(", ");
        return formatDetailValue(entry);
    }).filter(Boolean);
    return formatted.join("; ");
}

function firstSemanticValue(...values) {
    return values.find(hasValue);
}
