import { getBrowserFilterDefinitions } from "./rules-browser-config.js";

const COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base"
});

export function normalizeBrowserFieldFilters(entityType, values = {}) {
    const allowed = new Set(
        getBrowserFilterDefinitions(entityType)
            .filter(definition => definition.mode === "client-complete")
            .map(definition => definition.key));
    const normalized = {};
    for (const [key, value] of Object.entries(values ?? {})) {
        const text = String(value ?? "").trim();
        if (allowed.has(key) && text) normalized[key] = text;
    }
    return normalized;
}

export function countActiveBrowserFilters(entityType, {
    sourceCode = "",
    overridesOnly = false,
    fieldFilters = {}
} = {}) {
    return (sourceCode ? 1 : 0)
        + (overridesOnly ? 1 : 0)
        + Object.keys(normalizeBrowserFieldFilters(entityType, fieldFilters)).length;
}

export function hasClientBrowserFilters(entityType, fieldFilters = {}) {
    return Object.keys(normalizeBrowserFieldFilters(entityType, fieldFilters)).length > 0;
}

export function filterRulesForBrowser(rules, entityType, fieldFilters = {}) {
    const normalized = normalizeBrowserFieldFilters(entityType, fieldFilters);
    const active = Object.entries(normalized);
    if (!active.length) return [...rules];

    const definitions = new Map(
        getBrowserFilterDefinitions(entityType)
            .filter(definition => definition.mode === "client-complete")
            .map(definition => [definition.key, definition]));

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
        const value = (rule?.browserFields ?? [])
            .find(field => field.key === source.field)?.value;
        return normalizeValues(value);
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

function normalizeValues(value) {
    if (Array.isArray(value)) {
        return value.flatMap(normalizeValues);
    }
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    return [text];
}
