import { getBrowserFilterDefinitions } from "./rules-browser-config.js";

const COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
});

export function normalizeBrowserFieldFilters(entityType, values = {}) {
    const allowed = new Set(
        getRoutedBrowserFilterDefinitions(entityType)
            .map(definition => definition.key));
    const normalized = {};
    for (const [key, value] of Object.entries(values ?? {})) {
        const text = String(value ?? "").trim();
        if (allowed.has(key) && text) normalized[key] = text;
    }
    return normalized;
}

export function normalizeBrowserFieldFiltersForEntityTransition(
    sourceEntityType,
    destinationEntityType,
    values = {})
{
    const sourceNormalized = normalizeBrowserFieldFilters(sourceEntityType, values);
    const destinationNormalized = normalizeBrowserFieldFilters(
        destinationEntityType,
        sourceNormalized);
    const sourceDefinitions = new Map(
        getRoutedBrowserFilterDefinitions(sourceEntityType)
            .map(definition => [definition.key, definition]));
    const destinationDefinitions = new Map(
        getRoutedBrowserFilterDefinitions(destinationEntityType)
            .map(definition => [definition.key, definition]));
    const normalized = {};

    for (const [key, value] of Object.entries(destinationNormalized)) {
        if (browserFilterDefinitionsEquivalent(
            sourceDefinitions.get(key),
            destinationDefinitions.get(key))) {
            normalized[key] = value;
        }
    }
    return normalized;
}

export function normalizeBrowserFilterState(entityType, {
    sourceCode = "",
    overridesOnly = false,
    fieldFilters = {}
} = {}) {
    return {
        sourceCode: String(sourceCode ?? "").trim(),
        overridesOnly: Boolean(overridesOnly),
        fieldFilters: normalizeBrowserFieldFilters(entityType, fieldFilters)
    };
}

export function countActiveBrowserFilters(entityType, state = {}) {
    return activeBrowserFilterSummaries(entityType, state).length;
}

export function activeBrowserFilterSummaries(entityType, state = {}) {
    const normalized = normalizeBrowserFilterState(entityType, state);
    const definitions = new Map(
        getBrowserFilterDefinitions(entityType)
            .map(definition => [definition.key, definition]));
    const summaries = [];

    if (normalized.sourceCode) {
        summaries.push({
            key: "sourceCode",
            label: definitions.get("sourceCode")?.label ?? "Source",
            value: normalized.sourceCode
        });
    }
    if (normalized.overridesOnly) {
        summaries.push({
            key: "overridesOnly",
            label: definitions.get("overridesOnly")?.label ?? "Campaign state",
            value: "Overrides only"
        });
    }

    for (const definition of getRoutedBrowserFilterDefinitions(entityType)) {
        const value = normalized.fieldFilters[definition.key];
        if (!value) continue;
        summaries.push({
            key: definition.key,
            label: definition.label,
            value
        });
    }
    return summaries;
}

export function removeBrowserFilter(entityType, state = {}, key) {
    const normalized = normalizeBrowserFilterState(entityType, state);
    if (key === "sourceCode") {
        normalized.sourceCode = "";
        return normalized;
    }
    if (key === "overridesOnly") {
        normalized.overridesOnly = false;
        return normalized;
    }

    const fieldFilters = { ...normalized.fieldFilters };
    delete fieldFilters[key];
    return {
        ...normalized,
        fieldFilters: normalizeBrowserFieldFilters(entityType, fieldFilters)
    };
}

export function clearBrowserFilters(entityType) {
    return normalizeBrowserFilterState(entityType);
}

export function hasClientBrowserFilters(entityType, fieldFilters = {}) {
    const normalized = normalizeBrowserFieldFilters(entityType, fieldFilters);
    const clientKeys = new Set(
        getClientBrowserFilterDefinitions(entityType).map(definition => definition.key));
    return Object.keys(normalized).some(key => clientKeys.has(key));
}

export async function loadCompleteBrowserDataset({
    hasMore,
    loadMore,
    getLength,
    getError
}) {
    while (hasMore()) {
        const before = getLength();
        await loadMore();
        const error = getError();
        if (error) {
            return { complete: false, error };
        }
        if (getLength() === before) {
            return { complete: false, error: null };
        }
    }
    return { complete: true, error: null };
}

export function resolveBrowserFilterApplication(
    rules,
    entityType,
    fieldFilters = {},
    completeDataset = false)
{
    const active = hasClientBrowserFilters(entityType, fieldFilters);
    if (!active) {
        return { state: "inactive", rules: [...(rules ?? [])] };
    }
    if (!completeDataset) {
        return { state: "pending", rules: [] };
    }
    return {
        state: "applied",
        rules: filterRulesForBrowser(rules, entityType, fieldFilters)
    };
}

export function filterRulesForBrowser(rules, entityType, fieldFilters = {}) {
    const normalized = normalizeBrowserFieldFilters(entityType, fieldFilters);
    const definitions = new Map(
        getClientBrowserFilterDefinitions(entityType)
            .map(definition => [definition.key, definition]));
    const active = Object.entries(normalized)
        .filter(([key]) => definitions.has(key));
    if (!active.length) return [...rules];

    return rules.filter(rule => active.every(([key, expected]) => {
        const definition = definitions.get(key);
        if (!definition) return true;
        return browserFilterValues(rule, definition)
            .some(value => COLLATOR.compare(value, expected) === 0);
    }));
}

export function browserFilterOptions(rules, definition) {
    const values = new Map();
    for (const rule of rules ?? []) {
        for (const value of browserFilterValues(rule, definition)) {
            const normalized = value.toLocaleLowerCase();
            if (!values.has(normalized)) values.set(normalized, value);
        }
    }
    return [...values.values()].sort((left, right) => COLLATOR.compare(left, right));
}

export function browserFilterValues(rule, definition) {
    const source = definition?.value ?? {};
    if (source.kind === "property") {
        return normalizeValues(rule?.[source.property]);
    }
    if (source.kind === "browser-field") {
        return (rule?.browserFields ?? [])
            .filter(field => field?.key === source.field)
            .flatMap(field => normalizeValues(field?.value));
    }
    if (source.kind === "relationship") {
        return (rule?.relationships ?? [])
            .filter(relationship =>
                relationship.kind === source.relationshipKind
                && (!source.relatedEntityType
                    || relationship.relatedEntityType === source.relatedEntityType))
            .flatMap(relationship => normalizeValues(relationship.relatedDisplayName));
    }
    return [];
}

function getRoutedBrowserFilterDefinitions(entityType) {
    return getBrowserFilterDefinitions(entityType)
        .filter(definition =>
            definition.mode === "client-complete"
            || definition.mode === "server-reference");
}

function getClientBrowserFilterDefinitions(entityType) {
    return getBrowserFilterDefinitions(entityType)
        .filter(definition => definition.mode === "client-complete");
}

function browserFilterDefinitionsEquivalent(left, right) {
    if (!left || !right) return false;
    if (left.key !== right.key
        || left.label !== right.label
        || left.mode !== right.mode) {
        return false;
    }

    const leftValue = left.value ?? {};
    const rightValue = right.value ?? {};
    return leftValue.kind === rightValue.kind
        && leftValue.property === rightValue.property
        && leftValue.field === rightValue.field
        && leftValue.facet === rightValue.facet
        && leftValue.relationshipKind === rightValue.relationshipKind
        && leftValue.relatedEntityType === rightValue.relatedEntityType;
}

function normalizeValues(value) {
    if (Array.isArray(value)) {
        return value.flatMap(normalizeValues);
    }
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    return [text];
}
