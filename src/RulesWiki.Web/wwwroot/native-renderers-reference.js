/**
 * Native reference-family presentation. Layout is shared with the historical
 * structured rule renderer; all rich content is delegated to Workstream B.
 * Do not resolve mechanics or infer entity identity from display names.
 */
import { renderStructuredContent, renderNativeAttribution } from "./native-presentation.js";
import { nativeRuleIdentity } from "./rules-context.js";
import { element } from "./ui.js";
import { formatDetailValue, formatSize, formatSpeed, formatArmorClass, humanizeKey } from "./rule-renderer-support.js";
import {
    renderStructuredRule, formatSpellLevel, formatSpellSchool, formatCastingTime,
    formatSpellRange, formatSpellComponents, formatSpellDuration, hasConcentration,
    formatItemType, formatRarity, formatItemDamage, formatWeight, formatCurrency,
    formatAttunement, formatAbilityReference, formatFeatCategory
} from "./rule-renderers-specialized.js";

const FIRST = "first-party-001";
const DND = new Set(["dnd-5e", "dnd-5-5e"]);
const EQUIPMENT = new Set(["item", "baseitem", "item-group", "magic-variant", "item-property", "item-mastery", "item-type"]);
const IMPORTED_ORIGINS = new Set(["race", "subrace", "species", "subspecies", "background"]);
const NATIVE_ORIGINS = new Set(["species", "subspecies", "ancestry", "heritage", "origination", "origin-trait", "manifestation", "upbringing", "background",
    "construct-component", "construct-design", "construct-material", "construct-enhancement", "construct-power-source",
    "crafting-recipe", "crafting-material"]);
const SKILLS = new Set(["skill", "skill-family", "competency", "competency-category"]);
const TEXTUAL = new Set(["action", "activity", "attack-option", "combat-option", "equipment-option", "reaction-option",
    "rule", "rulebook", "rulebook-page", "chapter", "section", "language", "sense", "glossary", "hazard", "trap",
    "environmental-effect", "disease", "magical-contagion", "status", "deity", "optional-feature"]);
const present = value => value !== undefined && value !== null && value !== "";
const own = (record, key) => Object.hasOwn(record, key);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const has = (record, keys) => keys.some(key => own(record, key) && present(record[key]));
const imported = input => DND.has(input.context.rulesetId);
const first = input => input.context.rulesetId === FIRST;
const fate = input => input.context.rulesetId === "fate-condensed";
const schema = input => object(input.record) && (!own(input.record, "id") || input.record.id === input.rule.id) &&
    (!own(input.record, "kind") || input.record.kind === input.rule.kind);
// Core can preserve a wrapper. Only a known first-party identity-matched
// definition may be read as a gameplay payload; the original remains intact.
function payload(input) {
    const r = input.record;
    if (first(input) && r.id === input.rule.id && object(r.definition))
        return r.definition;
    return r;
}

const format = (value, formatter = formatDetailValue) => present(value) ? formatter(value) : null;
const sourceLabel = value => typeof value === "string" ? value.split("|")[0] : value;
// Display labels for observed D&D source codes; do not infer a rule ID.
const abilityLabels = new Map([["str","Strength"], ["dex","Dexterity"], ["con","Constitution"],
    ["int","Intelligence"], ["wis","Wisdom"], ["cha","Charisma"], ["strength","Strength"],
    ["dexterity","Dexterity"], ["constitution","Constitution"], ["intelligence","Intelligence"],
    ["wisdom","Wisdom"], ["charisma","Charisma"]]);
const propertyLabels = new Map([["2H","Two-Handed"], ["A","Ammunition"], ["F","Finesse"], ["H","Heavy"],
    ["L","Light"], ["LD","Loading"], ["R","Reach"], ["T","Thrown"], ["V","Versatile"]]);
function propertyName(input, value) {
    const code = sourceLabel(value);
    if (typeof code !== "string") return formatDetailValue(code);
    if (input.context.rulesetId === "dnd-5e" && code.toUpperCase() === "S") return "Special";
    return propertyLabels.get(code.toUpperCase()) ?? code;
}
function abilityName(value) {
    return typeof value === "string" ? abilityLabels.get(value.toLowerCase()) ?? value : formatAbilityReference(value);
}
const yesNo = value => typeof value === "boolean" ? (value ? "Yes" : "No") : null;
const sign = value => typeof value === "number" && value >= 0 ? "+" + value : value;
const labels = {
    entries: "Rules", entriesHigherLevel: "Higher-level effects", officialTextLayout: "Publisher text",
    defaultAbility: "Default ability", childSkills: "Component skills", parentSkill: "Parent skill",
    family: "Skill family", competencyIds: "Competencies", startingEquipment: "Starting equipment",
    ability: "Ability scores", skillProficiencies: "Skill proficiencies", toolProficiencies: "Tool proficiencies",
    languageProficiencies: "Languages", trait: "Trait definition", traits: "Traits",
    inherits: "Template inheritance", requires: "Eligible base items", excludes: "Excluded base items",
    baseItemId: "Base item ID", variantOf: "Derived from template", reqAttuneTags: "Attunement prerequisites",
    property: "Weapon properties", mastery: "Weapon Mastery", reviewNotes: "Review notes", _versions: "Versions"
};
const nameOf = key => Object.hasOwn(labels, key) ? labels[key] : humanizeKey(key);

function content(input, value) {
    // One rich renderer: the foundation implementation is intentionally inert.
    // B owns Markdown/tag interpretation, including the typed Markdown wrapper.
    return renderStructuredContent(value, { input });
}

const referenceFields = new Set(["catalogReferences", "parentId", "baseItemId", "variantOf", "traitId",
    "parentSkill", "childSkills", "family", "competencyIds", "skillId", "skill", "actionId",
    "craftingRecipeId", "producesDefinitionId", "speciesId", "subspeciesId", "parentSpecies", "parentAncestry",
    "parent", "defaultUpbringing", "ruleId", "groupIds", "requiresTraitDefinitionId"]);
function explicitReferences(record, rulesetId) {
    const ids = new Set();
    const add = value => {
        if (Array.isArray(value)) { value.forEach(add); return; }
        if (typeof value !== "string") return;
        try { ids.add(nativeRuleIdentity(value)); } catch { /* Non-native labels stay in source content. */ }
    };
    const walk = value => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (!object(value)) return;
        // A source object explicitly scoped to a different catalog is not a local reference.
        if (typeof value.rulesetId === "string" && value.rulesetId !== rulesetId) return;
        for (const [key, entry] of Object.entries(value)) {
            if (["source", "sourcePackage", "officialTextLayout", "markdown"].includes(key)) continue;
            if (referenceFields.has(key)) add(entry);
            if (typeof entry === "object" && entry !== null) walk(entry);
        }
    };
    walk(record);
    return [...ids];
}
function references(input) {
    const ids = explicitReferences(input.record, input.context.rulesetId).filter(id => id !== input.rule.id);
    if (!ids.length) return null;
    const list = element("ul");
    for (const id of ids) list.append(element("li", {}, input.references
        ? element("a", { text: id, attributes: { href: input.hrefForRule(id) } })
        : element("span", { text: id })));
    return element("section", { className: "rules-core-structured-section native-reference-links" },
        element("h3", { className: "h5", text: "Related references" }), list);
}
const metadata = new Set(["id", "kind", "name", "source", "sourcePackage", "catalogReferences"]);
function validNativeId(id) {
    try { nativeRuleIdentity(id); return true; } catch { return false; }
}
const fieldSections = (record, keys) => keys.map(key => [nameOf(key), record[key]]);
function sourceDisclosure(input, title, value) {
    return element("details", { className: "rules-core-structured-section" },
        element("summary", { text: title }), content(input, value));
}
function publisherText(title, value, expanded = false) {
    return element("details", { className: "rules-core-structured-section", attributes: expanded ? { open: "" } : {} },
        element("summary", { text: title }), element("pre", { className: "text-wrap", text: value }));
}
// Native sections are explicit projections for reading, not replacement
// records. Unconsumed fields remain visible, including unknown nested shapes.
function frame(input, { summary = [], sections = [], consumed = [], disclose = false, publisher = null } = {}) {
    const r = payload(input);
    const used = new Set([...metadata, ...consumed]);
    const remaining = Object.entries(r).filter(([key, value]) => !used.has(key) && present(value))
        .map(([key, value]) => [nameOf(key), value]);
    // Preserve malformed reference fields as data, never as guessed links.
    if (present(r.catalogReferences) && (!Array.isArray(r.catalogReferences) || !r.catalogReferences.every(validNativeId)))
        remaining.push(["Catalog references (source data)", r.catalogReferences]);
    if (r !== input.record) {
        const wrapper = Object.fromEntries(Object.entries(input.record)
            .filter(([key]) => !metadata.has(key) && key !== "definition"));
        if (Object.keys(wrapper).length) remaining.push(["Record context", wrapper]);
    }
    const article = renderStructuredRule(r, {
        nativeTitle: input.rule.name, renderContent: value => content(input, value)
    }, { summary, sections: disclose ? sections : [...sections, ...remaining] });
    article.classList.add("card", "card-body", "mb-3", "native-reference-article");
    if (publisher && typeof publisher[1] === "string") article.append(publisherText(...publisher));
    if (disclose && remaining.length) article.append(sourceDisclosure(input, "Additional source fields",
        remaining.map(([name, value]) => ({ name, entries: [value] }))));
    const related = references(input);
    if (related) article.append(related);
    article.append(renderNativeAttribution(input));
    return article;
}

function spell(input) {
    const r = payload(input), h = object(r.header) ? r.header : {};
    const summary = [
        ["Level", format(r.level, formatSpellLevel)], ["School", format(r.school, formatSpellSchool)],
        ["Casting Time", h["Casting Time"] ?? format(r.time ?? r.castingTime, formatCastingTime)],
        ["Range", h.Range ?? format(r.range, formatSpellRange)],
        ["Components", h.Components ?? format(r.components, formatSpellComponents)],
        ["Duration", h.Duration ?? format(r.duration, formatSpellDuration)],
        ["Concentration", yesNo(r.concentration) ?? (hasConcentration(r.duration) ? "Yes" : null)],
        ["Ritual", yesNo(r.meta?.ritual ?? r.ritual)]
    ];
    const sections = [["Rules", r.entries ?? r.description], ["Higher-level effects", r.entriesHigherLevel ?? r.higherLevel]];
    // Keep precise component/range/duration fields and publisher text even
    // when the concise, edition-specific header is sufficient for reading.
    return frame(input, { summary, sections, disclose: true,
        publisher: ["Publisher text", r.officialTextLayout], consumed: [
        "entries", ...(r.entries === undefined ? ["description"] : []),
        "entriesHigherLevel", ...(r.entriesHigherLevel === undefined ? ["higherLevel"] : []),
        ...(typeof r.officialTextLayout === "string" ? ["officialTextLayout"] : [])
    ] });
}

function equipment(input) {
    const r = payload(input), template = input.rule.kind === "magic-variant",
        group = input.rule.kind === "item-group";
    const category = template ? "Magic item template" : group ? "Item group" :
        input.rule.kind === "baseitem" ? "Base item" : r.variantOf ? "Derived item" : nameOf(input.rule.kind);
    const summary = [["Reference type", category], ["Item type", format(sourceLabel(r.type), formatItemType)],
        ["Rarity", format(r.rarity, formatRarity)]];
    // A template or group does not acquire concrete statistics from its
    // inheritance record. Show those authored requirements below instead.
    if (!template && !group) summary.push(
        ["Armor Class", format(r.ac ?? r.armorClass, formatArmorClass)],
        ["Damage", format(r.dmg1 ?? r.damage, () => formatItemDamage(r))],
        ["Weight", format(r.weight, formatWeight)], ["Value", format(r.value, formatCurrency)],
        ["Attunement", format(r.reqAttune ?? r.requiresAttunement, value => object(value) || Array.isArray(value)
            ? formatDetailValue(value) : formatAttunement(value))],
        ["Weapon category", format(r.weaponCategory)],
        ["Weapon properties", Array.isArray(r.property) ? r.property.map(x => propertyName(input, x)).join(", ") : format(r.property)],
        ["Weapon Mastery", format(Array.isArray(r.mastery) ? r.mastery.map(sourceLabel) : r.mastery)]);
    const fields = ["property", "mastery", "reqAttuneTags", "prerequisite", "requires", "excludes", "inherits",
        "items", "baseItem", "baseItemId", "variantOf", "dmg2", "range", "strength", "stealth",
        "containerCapacity", "packContents", "charges", "recharge", "resist", "bonusAc", "bonusWeapon"];
    return frame(input, { summary, sections: [["Rules", r.entries ?? r.description], ...fieldSections(r, fields)],
        disclose: true, consumed: [...fields, "entries", ...(r.entries === undefined ? ["description"] : [])] });
}
function nativeEquipment(input) {
    const r = payload(input);
    return frame(input, { summary: [["Reference type", nameOf(input.rule.kind)],
        ["Equipment category", format(r.equipmentCategory)]],
        sections: [["Description", r.description], ["Qualification groups", r.groupIds]],
        consumed: ["description", "groupIds"] });
}
function importedOrigin(input) {
    const r = payload(input);
    return frame(input, { summary: [
        ["Origin type", nameOf(input.rule.kind)], ["Size", format(r.size, formatSize)],
        ["Speed", format(r.speed, formatSpeed)], ["Parent race", format(r.raceName)],
        ["Creature type", format(r.creatureTypes ?? r.creatureType)]
    ], sections: [[input.rule.kind === "background" ? "Rules" : "Traits", r.entries],
        ...fieldSections(r, ["ability", "skillProficiencies", "toolProficiencies", "weaponProficiencies",
            "languageProficiencies", "feats", "startingEquipment", "additionalSpells", "sizeEntry"])],
        consumed: ["entries", "ability", "skillProficiencies", "toolProficiencies", "weaponProficiencies",
            "languageProficiencies", "feats", "startingEquipment", "additionalSpells", "sizeEntry"], disclose: true });
}
function nativeOrigin(input) {
    const r = payload(input);
    return frame(input, { summary: [
        ["Origin type", nameOf(input.rule.kind)], ["Status", format(r.status ?? r.rulesStatus)],
        ["Selectable", yesNo(r.selectable)], ["Creature type", format(r.creatureType)],
        ["Walking speed", present(r.walkingSpeedFeet) ? r.walkingSpeedFeet + " ft." : null]
    ], sections: [["Description", r.description], ["Traits", r.traits], ["Benefits", r.benefits],
        ["Trait definition", r.trait]], consumed: ["description", "traits", "benefits", "trait"] });
}
function originRule(input) {
    const r = payload(input);
    const fields = ["scope", "methodDefinitions", "methodInheritance", "methodAvailability", "compatibility",
        "biologicalTransmission", "riteOfRebirth", "darkvisionSensitivity", "upbringings", "originInheritance",
        "duplicateTraining", "dmOverridePolicy"];
    return frame(input, { summary: [["Status", format(r.status)]], sections: fieldSections(r, fields), consumed: fields });
}
function condition(input) {
    const r = payload(input);
    return frame(input, { summary: [["Levels", typeof r.levels === "number" ? r.levels : null]],
        sections: [["Summary", r.description], ["Rules", r.entries]], consumed: ["description", "entries"] });
}
function skill(input) {
    const r = payload(input);
    const summary = fate(input) ? [["Default rating", sign(r.defaultRating)]] : [
        ["Ability", format(r.ability ?? r.stat ?? r.defaultAbility, abilityName)],
        ["Independently ranked", yesNo(r.independentlyRanked)],
        ["Independent children", yesNo(r.independentChildren)]];
    return frame(input, { summary, sections: [["Description", r.description], ["Rules", r.entries]],
        consumed: ["description", "entries"] });
}
function feat(input) {
    const r = payload(input);
    return frame(input, { summary: [["Category", format(r.category, formatFeatCategory)], ["Repeatable", yesNo(r.repeatable)]],
        sections: [["Prerequisites", r.prerequisite], ["Rules", r.entries ?? r.description]],
        consumed: ["prerequisite", "entries", ...(r.entries === undefined ? ["description"] : [])] });
}
function table(input) {
    const r = payload(input);
    return frame(input, { sections: [["Table", { type: "table", name: input.rule.name, colLabels: r.colLabels,
        rows: r.rows, ...(present(r.colStyles) ? { colStyles: r.colStyles } : {}) }]],
        consumed: ["colLabels", "rows", "colStyles"] });
}
function fateRule(input) {
    const r = payload(input);
    const sections = [];
    const consumed = [];
    if (Array.isArray(r.ratings) && r.ratings.every(x => object(x) && typeof x.rating === "number" && typeof x.name === "string")) {
        sections.push(["Ratings", { type: "table", colLabels: ["Rating", "Adjective"], rows: r.ratings.map(x => [sign(x.rating), x.name]) }]);
        // Keep the original structured data in case a future row has extra fields.
    }
    if (Array.isArray(r.allocations) && r.allocations.every(x => object(x) && typeof x.rating === "number" && typeof x.count === "number"))
        sections.push(["Starting skill allocations", { type: "table", colLabels: ["Rating", "Skills"], rows: r.allocations.map(x => [sign(x.rating), x.count]) }]);
    if (Array.isArray(r.thresholds) && r.thresholds.every(x => object(x) && typeof x.minimumRating === "number" && typeof x.boxes === "number"))
        sections.push(["Stress thresholds", { type: "table", colLabels: ["Minimum rating", "Boxes", "Additional mild consequence"],
            rows: r.thresholds.map(x => [sign(x.minimumRating), x.boxes, yesNo(x.additionalMildConsequence) ?? "—"]) }]);
    return frame(input, { summary: [["Remaining rating", sign(r.remainingRating)], ["Box value", r.boxValue]],
        sections: [...sections, ...fieldSections(r, ["tracks"])], consumed: [...consumed, "tracks"], disclose: true });
}
function textual(input) {
    const r = payload(input);
    const sections = [["Rules", r.entries ?? r.rules ?? r.text], ["Description", r.description]];
    if (typeof r.markdown === "string") sections.unshift(["Source text", { markdown: r.markdown }]);
    // Page records preserve the publisher line layout as inert, selectable text.
    return frame(input, { summary: [
        ["Time", format(r.time, formatCastingTime)], ["Reactive", yesNo(r.reactive)],
        ["Heading level", typeof r.headingLevel === "number" ? r.headingLevel : null], ["Page", r.page]
    ], sections, publisher: ["Publisher page", r.textLayout, true], consumed: ["entries", ...(r.entries === undefined ? ["rules"] : []),
        ...(r.entries === undefined && r.rules === undefined ? ["text"] : []), "description", "markdown", "textLayout"] });
}

/** Specific adapters win over generic textual entries; C/D may register
 * higher-priority structural adapters for class/creature-specific features. */
export function registerNativeRenderers(registry) {
    const add = (id, supports, render, priority = 10) =>
        registry.register({ id: "reference." + id, supports: input => schema(input) && supports(input), render, priority });
    add("spell", i => i.rule.kind === "spell" && (imported(i) || first(i)) &&
        has(payload(i), ["level", "school", "header", "castingTime", "time"]), spell);
    add("equipment", i => imported(i) && EQUIPMENT.has(i.rule.kind) &&
        has(payload(i), ["type", "entries", "rarity", "requires", "inherits", "items", "abbreviation", "template", "baseItemId"]), equipment);
    add("native-equipment", i => first(i) && ["equipment-group", "equipment-type"].includes(i.rule.kind) &&
        has(payload(i), ["equipmentCategory", "groupIds"]), nativeEquipment);
    add("imported-origin", i => imported(i) && IMPORTED_ORIGINS.has(i.rule.kind) &&
        has(payload(i), ["entries", "size", "raceName", "startingEquipment", "skillProficiencies"]), importedOrigin);
    add("native-origin", i => first(i) && NATIVE_ORIGINS.has(i.rule.kind) &&
        has(payload(i), ["description", "traits", "trait", "benefits", "rulesStatus", "status", "sizeChoice"]), nativeOrigin);
    add("origin-rule", i => first(i) && i.rule.kind === "rule" &&
        ((Array.isArray(payload(i).methodDefinitions) && object(payload(i).methodInheritance)) ||
         (object(payload(i).upbringings) && object(payload(i).originInheritance))), originRule);
    // Do not supersede the established first-party condition renderer.
    add("condition", i => imported(i) && i.rule.kind === "condition" && Array.isArray(payload(i).entries), condition);
    add("skill", i => SKILLS.has(i.rule.kind) && (
        (first(i) && has(payload(i), ["description", "defaultAbility", "parentSkill", "family", "childSkills", "profile", "competencyIds", "independentChildren"])) ||
        (imported(i) && has(payload(i), ["ability", "entries"])) ||
        (fate(i) && i.rule.kind === "skill" && own(payload(i), "defaultRating"))), skill);
    add("feat", i => imported(i) && i.rule.kind === "feat" && has(payload(i), ["entries", "prerequisite", "category"]), feat);
    add("table", i => (imported(i) || fate(i)) && i.rule.kind === "table" &&
        Array.isArray(payload(i).rows) && payload(i).rows.every(row => Array.isArray(row) ||
            (object(row) && Array.isArray(row.row))) && Array.isArray(payload(i).colLabels), table);
    add("fate-ratings", i => fate(i) && i.rule.kind === "rule" &&
        has(payload(i), ["ratings", "allocations", "thresholds"]), fateRule);
    add("text", i => (imported(i) || fate(i)) && TEXTUAL.has(i.rule.kind) &&
        has(payload(i), ["entries", "markdown", "description", "rules", "text", "textLayout", "typicalSpeakers", "dialects", "type"]), textual, -100);
}
