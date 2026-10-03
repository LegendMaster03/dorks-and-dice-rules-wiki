import { codeBlock, element } from "./ui.js";
import {
    PRESENTATION_METADATA_FIELDS,
    firstDefined,
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

export function renderGenericReference(document = {}, options = {}) {
    const entries = firstDefined(document?.entries, document?.rules, document?.text);
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
            ["Feat", formatDetailValue(firstDefined(document?.feats, document?.feat))]
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
            ["Feature Type", formatFeatureTypes(firstDefined(document?.featureType, document?.type))]
        ],
        details: [
            ["Prerequisite", formatDetailValue(firstDefined(document?.prerequisite, document?.prerequisites))]
        ],
        sections: [["Rules", document?.entries]],
        consumed: ["featureType", "type", "prerequisite", "prerequisites", "entries"]
    });
}

export function renderCrossEditionSkill(document = {}, options = {}) {
    const competency = document?._rulesCore?.competency;
    const ability = firstDefined(
        document?.ability,
        document?.stat,
        competency?.governingAbilityKey);
    const presentationDocument = {
        ...document,
        _rulesCore: rulesCoreForPresentation(document?._rulesCore)
    };
    return renderReferenceRule(presentationDocument, options, {
        summary: [
            ["Ability", formatAbility(ability)],
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
        consumed: ["ability", "stat", "entries"],
        rulesCoreConsumed: ["competency"]
    });
}

export function renderCrossEditionSpell(document = {}, options = {}) {
    const legacyLabels = [
        "School", "Casting Time", "Range", "Components", "Duration", "Subschool",
        "Descriptor", "Descriptors", "Level", "Material Component", "Material Components",
        "Focus", "Divine Focus", "XP Cost", "Target", "Targets", "Area", "Effect",
        "Saving Throw", "Spell Resistance"
    ];
    const sourceComponents = firstDefined(document?.components, threeXField(document, "Components"));
    const components = sourceComponents && typeof sourceComponents === "object" && !Array.isArray(sourceComponents)
        ? sourceComponents
        : null;
    const baseDocument = omitTopLevel({
        ...document,
        school: firstDefined(document?.school, threeXField(document, "School")),
        time: firstDefined(document?.time, document?.castingTime, threeXField(document, "Casting Time")),
        range: firstDefined(document?.range, threeXField(document, "Range")),
        components: components
            ? omitProperties(components, ["f", "df", "xp", "focus", "divineFocus", "xpCost"])
            : sourceComponents,
        duration: firstDefined(document?.duration, threeXField(document, "Duration")),
        _rulesCore: rulesCoreForPresentation(document?._rulesCore, legacyLabels)
    }, [
        "castingTime", "subschool", "descriptor", "descriptors", "classLevels", "spellLevels", "levelsByClass",
        "spellLists", "targets", "target", "area", "effect", "savingThrow", "spellResistance",
        "focus", "divineFocus", "xpCost", "materialComponents"
    ]);

    const root = renderBaseSpell(baseDocument, { ...options, showDocument: false });
    appendLabeledSection(root, "3.x Spell Mechanics", [
        ["Subschool", firstDefined(document?.subschool, threeXField(document, "Subschool"))],
        ["Descriptors", firstDefined(document?.descriptors, document?.descriptor, threeXField(document, "Descriptors", "Descriptor"))],
        ["Class / List Access", firstDefined(document?.classes, document?.groups, document?.spellLists)],
        ["Class-Dependent Levels", firstDefined(document?.classLevels, document?.spellLevels, document?.levelsByClass, threeXField(document, "Level"))],
        ["Material Components", firstDefined(document?.materialComponents, components?.m, threeXField(document, "Material Components", "Material Component"))],
        ["Focus", firstDefined(document?.focus, components?.f, components?.focus, threeXField(document, "Focus"))],
        ["Divine Focus", firstDefined(document?.divineFocus, components?.df, components?.divineFocus, threeXField(document, "Divine Focus"))],
        ["XP Cost", firstDefined(document?.xpCost, components?.xp, components?.xpCost, threeXField(document, "XP Cost"))],
        ["Targets", firstDefined(document?.targets, document?.target, threeXField(document, "Targets", "Target"))],
        ["Area", firstDefined(document?.area, threeXField(document, "Area"))],
        ["Effect", firstDefined(document?.effect, threeXField(document, "Effect"))],
        ["Saving Throw", firstDefined(document?.savingThrow, threeXField(document, "Saving Throw"))],
        ["Spell Resistance", firstDefined(document?.spellResistance, threeXField(document, "Spell Resistance"))]
    ]);

    if (options.showDocument !== false) appendDocumentDisclosure(root, document, options.documentLabel);
    return root;
}

export function renderCrossEditionItem(document = {}, options = {}) {
    const legacyLabels = [
        "Type", "Rarity", "Price", "Market Price", "Cost", "Weight", "Attunement",
        "Aura", "Caster Level", "Slot", "Prerequisite", "Prerequisites", "Requirements",
        "Charges", "Enhancement Bonus"
    ];
    const baseDocument = {
        ...document,
        type: firstDefined(document?.type, threeXField(document, "Type")),
        rarity: firstDefined(document?.rarity, threeXField(document, "Rarity")),
        value: firstDefined(document?.value, document?.cost, threeXField(document, "Price", "Market Price", "Cost")),
        weight: firstDefined(document?.weight, threeXField(document, "Weight")),
        reqAttune: firstDefined(document?.reqAttune, document?.requiresAttunement, threeXField(document, "Attunement")),
        _rulesCore: rulesCoreForPresentation(document?._rulesCore, legacyLabels)
    };

    const root = renderBaseItem(baseDocument, { ...options, showDocument: false });
    appendLabeledSection(root, "3.x Item Mechanics", [
        ["Aura", threeXField(document, "Aura")],
        ["Caster Level", threeXField(document, "Caster Level")],
        ["Slot", threeXField(document, "Slot")],
        ["Prerequisites", firstDefined(document?.prerequisite, document?.prerequisites, threeXField(document, "Prerequisites", "Prerequisite", "Requirements"))],
        ["Cost to Create", threeXField(document, "Cost")],
        ["Charges", firstDefined(document?.charges, threeXField(document, "Charges"))],
        ["Enhancement Bonus", firstDefined(document?.enhancementBonus, document?.bonusWeapon, document?.bonusAc, threeXField(document, "Enhancement Bonus"))]
    ]);

    if (options.showDocument !== false) appendDocumentDisclosure(root, document, options.documentLabel);
    return root;
}

function renderReferenceRule(
    document = {},
    options = {},
    { summary = [], details = [], sections = [], consumed = [], rulesCoreConsumed = [] } = {})
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

    const extension = omitProperties(document?._rulesCore, rulesCoreConsumed);
    root.append(...renderRulesCoreExtensions(extension));

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

function rulesCoreForPresentation(extension, consumedThreeXFields = []) {
    if (!extension || typeof extension !== "object" || Array.isArray(extension)) return extension;
    const result = { ...extension };
    const threeX = extension.threeX;
    if (!threeX || typeof threeX !== "object" || Array.isArray(threeX)) return result;

    const cleanedThreeX = { ...threeX };
    delete cleanedThreeX.sourceBody;
    if (cleanedThreeX.fields && typeof cleanedThreeX.fields === "object" && !Array.isArray(cleanedThreeX.fields)) {
        const consumed = new Set(consumedThreeXFields.map(value => String(value).toLowerCase()));
        const remainingFields = Object.fromEntries(Object.entries(cleanedThreeX.fields)
            .filter(([key, value]) => !consumed.has(key.toLowerCase()) && hasValue(value)));
        if (Object.keys(remainingFields).length) cleanedThreeX.fields = remainingFields;
        else delete cleanedThreeX.fields;
    }

    if (Object.keys(cleanedThreeX).length) result.threeX = cleanedThreeX;
    else delete result.threeX;
    return Object.keys(result).length ? result : null;
}

function threeXField(document, ...names) {
    const fields = document?._rulesCore?.threeX?.fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
    const entries = Object.entries(fields);
    for (const name of names) {
        const match = entries.find(([key]) => key.toLowerCase() === String(name).toLowerCase());
        if (match && hasValue(match[1])) return match[1];
    }
    return null;
}

function omitTopLevel(value, names) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const omitted = new Set(names ?? []);
    return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function omitProperties(value, names) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (!names?.length) return value;
    const omitted = new Set(names);
    const result = Object.fromEntries(
        Object.entries(value).filter(([key]) => !omitted.has(key)));
    return Object.keys(result).length ? result : null;
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
