const CLASS_FAMILY_TYPES = new Set(["class", "subclass", "prestigeclass"]);

export function normalizeClassFamilyType(value) {
    return String(value ?? "").replace(/[-_\s]/g, "").toLowerCase();
}

export function isClassFamilyType(value) {
    return CLASS_FAMILY_TYPES.has(normalizeClassFamilyType(value));
}

export function isClassFamilyReference(detail) {
    if (!detail?.reference) return false;
    const categories = [
        detail.reference.entityType,
        detail.reference.effectiveCategory,
        ...(detail.reference.categoryHistory ?? []).map(value => value?.category),
        ...(detail.variations ?? []).map(value => value?.category)
    ];
    return categories.some(isClassFamilyType);
}

export function classFamilyKind(value) {
    const normalized = normalizeClassFamilyType(value);
    if (normalized === "prestigeclass") return "prestigeClass";
    if (normalized === "subclass") return "subclass";
    return normalized === "class" ? "class" : null;
}

export function findParentClassRelationship(reference) {
    return (reference?.relationships ?? []).find(value =>
        String(value?.kind ?? "").toLowerCase() === "parent-class"
        && normalizeClassFamilyType(value?.relatedEntityType) === "class") ?? null;
}

export function subclassesForClass(references, classReference) {
    const conceptKey = String(classReference?.conceptKey ?? "").toLowerCase();
    const conceptId = String(classReference?.ruleConceptId ?? "").toLowerCase();
    if (!conceptKey && !conceptId) return [];

    return (references ?? []).filter(reference =>
        (reference?.relationships ?? []).some(relationship => {
            if (String(relationship?.kind ?? "").toLowerCase() !== "parent-class") return false;
            if (normalizeClassFamilyType(relationship?.relatedEntityType) !== "class") return false;
            const relatedKey = String(relationship?.relatedConceptKey ?? "").toLowerCase();
            const relatedId = String(relationship?.relatedRuleConceptId ?? "").toLowerCase();
            return Boolean((conceptKey && relatedKey === conceptKey) || (conceptId && relatedId === conceptId));
        }));
}

export function classFamilyIdentityFields(document = {}, category = "class") {
    const kind = classFamilyKind(category) ?? "class";
    const fields = [];
    const add = (label, value) => {
        if (hasValue(value)) fields.push({ label, value });
    };

    add("Hit Die", firstDefined(document.hd, document.hitDie));
    add("Primary Ability", firstDefined(document.primaryAbility, document.primaryAbilities));
    add("Saving Throws", firstDefined(document.proficiency, document.savingThrows));
    const startingProficiencies = document.startingProficiencies && typeof document.startingProficiencies === "object"
        ? document.startingProficiencies
        : {};
    add("Armor Proficiencies", firstDefined(
        document.armorProficiencies, document.armorProficiency, startingProficiencies.armor));
    add("Weapon Proficiencies", firstDefined(
        document.weaponProficiencies, document.weaponProficiency, startingProficiencies.weapons));
    add("Tool Proficiencies", firstDefined(
        document.toolProficiencies, document.toolProficiency, startingProficiencies.tools));
    add("Skill Selection", firstDefined(
        document.skillProficiencies, document.skillSelection, document.skills, startingProficiencies.skills));
    add("Spellcasting Ability", firstDefined(document.spellcastingAbility, document.casterAbility));
    add("Caster Progression", document.casterProgression);

    if (kind === "subclass") {
        add("Parent Class", firstDefined(document.className, document.class));
        add("Class Source", document.classSource);
    }
    if (kind === "prestigeClass") {
        add("Prerequisites", firstDefined(document.prerequisite, document.prerequisites));
    }

    const character = rulesCoreCharacter(document);
    add("Maximum Level", character.maximumLevel);
    add("Base Attack Progression", character.baseAttackProgression);
    add("Fortitude Progression", character.saveProgressions?.fortitude);
    add("Reflex Progression", character.saveProgressions?.reflex);
    add("Will Progression", character.saveProgressions?.will);
    add("Skill Points", firstDefined(character.startingSkillPoints, character.skillPoints));
    add("Class Skills", character.classSkills);
    add("Spellcasting Profile", character.spellcastingProfile);

    return deduplicateFields(fields);
}

export function progressionSurfaces(document = {}) {
    const surfaces = [];

    appendObjectRowsSurface(surfaces, "Progression", document.progression);
    appendExplicitTableSurface(surfaces, "Progression", document.progressionTable);
    appendExplicitTableSurface(surfaces, "Class Progression", document.classTable);
    appendExplicitTableSurface(surfaces, "Progression", document.table);

    const groups = Array.isArray(document.classTableGroups) ? document.classTableGroups : [];
    groups.forEach((group, groupIndex) => {
        if (!group || typeof group !== "object") return;
        const title = firstText(group.title, group.name, group.groupName, group.label)
            || (groups.length > 1 ? `Progression ${groupIndex + 1}` : "Class Progression");
        const labels = normalizeLabels(group.colLabels ?? group.columns ?? group.columnLabels);
        appendArrayRowsSurface(surfaces, title, labels, group.rows, { inferLevelFromIndex: true });
        appendArrayRowsSurface(
            surfaces,
            labels.length ? `${title} — Spellcasting` : "Spellcasting Progression",
            labels,
            group.rowsSpellProgression,
            { inferLevelFromIndex: true });
        appendObjectRowsSurface(surfaces, title, group.progression);
    });

    const character = rulesCoreCharacter(document);
    appendObjectRowsSurface(surfaces, "Rules Core Progression", character.progression);
    appendExplicitTableSurface(surfaces, "Rules Core Progression", character.progressionTable);

    return deduplicateSurfaces(surfaces);
}

export function featureGroups(document = {}, category = "class") {
    const kind = classFamilyKind(category) ?? "class";
    const candidates = kind === "subclass"
        ? [
            ["Subclass Features", document.subclassFeatures],
            ["Features by Level", document.featuresByLevel],
            ["Features", document.features]
        ]
        : kind === "prestigeClass"
            ? [
                ["Prestige Class Features", firstDefined(document.prestigeClassFeatures, document.classFeatures)],
                ["Features by Level", document.featuresByLevel],
                ["Features", document.features]
            ]
            : [
                ["Class Features", document.classFeatures],
                ["Features by Level", document.featuresByLevel],
                ["Features", document.features]
            ];

    for (const [label, value] of candidates) {
        const groups = groupFeatureValue(value, label);
        if (groups.length) return groups;
    }
    return [];
}

export function explicitPrestigePrerequisites(document = {}) {
    return firstDefined(document.prerequisite, document.prerequisites, document.requirements);
}

export function humanizeClassFamilyType(value) {
    const kind = classFamilyKind(value);
    if (kind === "prestigeClass") return "Prestige Class";
    if (kind === "subclass") return "Subclass";
    if (kind === "class") return "Class";
    return String(value ?? "Rule")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}

function appendObjectRowsSurface(surfaces, title, value) {
    if (!Array.isArray(value) || !value.length || !value.every(isPlainObject)) return;
    const columns = orderedObjectKeys(value);
    if (!columns.length) return;
    surfaces.push({
        title,
        columns: columns.map(key => ({ key, label: humanizeKey(key) })),
        rows: value.map(row => columns.map(key => row[key]))
    });
}

function appendExplicitTableSurface(surfaces, title, table) {
    if (!table || typeof table !== "object" || Array.isArray(table)) return;
    const labels = normalizeLabels(table.colLabels ?? table.columns ?? table.columnLabels);
    appendArrayRowsSurface(surfaces, firstText(table.title, table.name, table.label) || title, labels, table.rows, {
        inferLevelFromIndex: table.rowsAreLevels === true || table.levelRows === true
    });
    appendObjectRowsSurface(surfaces, firstText(table.title, table.name, table.label) || title, table.rows);
}

function appendArrayRowsSurface(surfaces, title, labels, rows, { inferLevelFromIndex = false } = {}) {
    if (!Array.isArray(rows) || !rows.length || !rows.every(Array.isArray)) return;
    const width = Math.max(...rows.map(row => row.length), labels.length);
    if (!Number.isFinite(width) || width <= 0) return;

    const normalizedLabels = [...labels];
    while (normalizedLabels.length < width) normalizedLabels.push(`Column ${normalizedLabels.length + 1}`);
    const columns = normalizedLabels.slice(0, width).map((label, index) => ({ key: `column-${index}`, label }));
    const normalizedRows = rows.map(row => {
        const values = Array.from({ length: width }, (_, index) => row[index]);
        return values;
    });

    if (inferLevelFromIndex && !normalizedLabels.some(label => /^level$/i.test(String(label).trim()))) {
        columns.unshift({ key: "level", label: "Level" });
        normalizedRows.forEach((row, index) => row.unshift(index + 1));
    }

    surfaces.push({ title, columns, rows: normalizedRows });
}

function groupFeatureValue(value, label) {
    if (!hasValue(value)) return [];

    if (isPlainObject(value)) {
        const entries = Object.entries(value);
        if (entries.length && entries.every(([key]) => isLevelKey(key))) {
            return entries.map(([key, features]) => ({
                level: normalizeLevelLabel(key),
                label,
                features: asFeatureArray(features)
            })).filter(group => group.features.length);
        }
        return [{ level: null, label, features: [value] }];
    }

    if (!Array.isArray(value)) return [{ level: null, label, features: [value] }];
    if (!value.length) return [];

    const groups = new Map();
    const ungrouped = [];
    value.forEach((feature, index) => {
        if (Array.isArray(feature)) {
            const normalized = asFeatureArray(feature);
            if (normalized.length) groups.set(String(index + 1), normalized);
            return;
        }
        if (isPlainObject(feature)) {
            const explicitLevel = firstDefined(feature.level, feature.classLevel, feature.characterLevel);
            if (hasValue(explicitLevel)) {
                const key = String(explicitLevel);
                const current = groups.get(key) ?? [];
                current.push(feature);
                groups.set(key, current);
                return;
            }
        }
        ungrouped.push(feature);
    });

    const result = [...groups.entries()].map(([level, features]) => ({ level, label, features }));
    if (ungrouped.length) result.push({ level: null, label, features: ungrouped });
    return result;
}

function rulesCoreCharacter(document) {
    return document?._rulesCore?.character && typeof document._rulesCore.character === "object"
        ? document._rulesCore.character
        : {};
}

function normalizeLabels(value) {
    if (!Array.isArray(value)) return [];
    return value.map(label => {
        if (typeof label === "string" || typeof label === "number") return String(label);
        if (isPlainObject(label)) return firstText(label.label, label.name, label.title) || formatPrimitive(label);
        return formatPrimitive(label);
    });
}

function orderedObjectKeys(rows) {
    const keys = [];
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!keys.includes(key)) keys.push(key);
        }
    }
    return keys;
}

function deduplicateFields(fields) {
    const seen = new Set();
    return fields.filter(field => {
        const key = field.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function deduplicateSurfaces(surfaces) {
    const seen = new Set();
    return surfaces.filter(surface => {
        const signature = JSON.stringify([surface.title, surface.columns, surface.rows]);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });
}

function humanizeKey(value) {
    return String(value ?? "")
        .replace(/[_-]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}

function firstText(...values) {
    return values.find(value => typeof value === "string" && value.trim())?.trim() ?? "";
}

function firstDefined(...values) {
    return values.find(hasValue);
}

function hasValue(value) {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (isPlainObject(value)) return Object.keys(value).length > 0;
    return true;
}

function asFeatureArray(value) {
    if (!hasValue(value)) return [];
    return Array.isArray(value) ? value.filter(hasValue) : [value];
}

function isLevelKey(value) {
    return /^\s*(?:level\s*)?\d+\s*$/i.test(String(value ?? ""));
}

function normalizeLevelLabel(value) {
    const match = /\d+/.exec(String(value ?? ""));
    return match ? match[0] : String(value ?? "");
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatPrimitive(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}
