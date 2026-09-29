const DEFAULT_COLUMNS = [
    column("name", "Name", "minmax(9rem, 2fr)"),
    column("entityType", "Type", "minmax(5rem, .8fr)"),
    column("source", "Source", "minmax(4rem, .65fr)")
];

const SHARED_FILTERS = [
    filter("sourceCode", "Source", "server", { kind: "source" }),
    filter("package", "Package", "client-complete", { kind: "property", property: "packageDisplayName" }),
    filter("edition", "Edition", "client-complete", { kind: "property", property: "editionDisplayName" }),
    filter("overridesOnly", "Campaign state", "server", { kind: "campaign-override" })
];

const FAMILY_CONFIGS = [
    config("", "All Content", null, DEFAULT_COLUMNS, [], {
        rowSummaryFields: ["edition"],
        renderer: "generic"
    }),
    config("monster", "Bestiary", "monsters", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("type", "Type", "minmax(5rem, .9fr)"),
        column("cr", "CR", "minmax(2.5rem, .4fr)", "center"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [
        fieldFilter("type", "Type"),
        fieldFilter("cr", "CR"),
        fieldFilter("size", "Size")
    ], {
        rowSummaryFields: ["size", "edition"],
        renderer: "monster",
        relationships: ["related-creature", "mechanic"]
    }),
    config("spell", "Spells", "spells", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("level", "Level", "minmax(4.5rem, .6fr)"),
        column("school", "School", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [
        fieldFilter("level", "Level"),
        fieldFilter("school", "School"),
        fieldFilter("castingTime", "Casting time"),
        fieldFilter("range", "Range")
    ], {
        rowSummaryFields: ["castingTime", "edition"],
        renderer: "spell"
    }),
    config("class", "Classes", "classes", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("hitDie", "Hit Die", "minmax(4rem, .55fr)", "center"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [fieldFilter("hitDie", "Hit die")], {
        rowSummaryFields: ["primaryAbility", "edition"],
        renderer: "class",
        relationships: ["subclass", "prestige-class"],
        workspace: "class-family"
    }),
    config("subclass", "Subclasses", "subclasses", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("parentClass", "Class", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [relationshipFilter("parentClass", "Class", "parent-class", "class")], {
        rowSummaryFields: ["edition"],
        renderer: "subclass",
        relationships: ["parent-class"],
        workspace: "class-family"
    }),
    config("prestigeClass", "Prestige Classes", "prestige-classes", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [fieldFilter("prerequisite", "Prerequisite")], {
        rowSummaryFields: ["prerequisite", "edition"],
        renderer: "prestigeClass",
        relationships: ["prerequisite"],
        workspace: "class-family"
    }),
    config("feat", "Feats", "feats", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("category", "Category", "minmax(6rem, 1fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [
        fieldFilter("category", "Category"),
        fieldFilter("prerequisite", "Prerequisite")
    ], {
        rowSummaryFields: ["prerequisite", "edition"],
        renderer: "feat"
    }),
    config("background", "Backgrounds", "backgrounds", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [], { rowSummaryFields: ["edition"], renderer: "generic" }),
    config("optionalfeature", "Options & Features", "optional-features", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [], { rowSummaryFields: ["edition"], renderer: "generic" }),
    config("species", "Species", "species", speciesColumns(), [
        fieldFilter("size", "Size"),
        fieldFilter("ability", "Ability")
    ], { rowSummaryFields: ["speed", "edition"], renderer: "species" }),
    config("subspecies", "Subspecies", "subspecies", speciesColumns(), [
        fieldFilter("size", "Size"),
        fieldFilter("ability", "Ability")
    ], { rowSummaryFields: ["speed", "edition"], renderer: "species" }),
    config("item", "Items", "items", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("type", "Type", "minmax(5rem, .8fr)"),
        column("rarity", "Rarity", "minmax(5rem, .8fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [
        fieldFilter("type", "Type"),
        fieldFilter("rarity", "Rarity"),
        fieldFilter("attunement", "Attunement")
    ], { rowSummaryFields: ["edition"], renderer: "item" }),
    config("condition", "Conditions", "conditions", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [], { rowSummaryFields: ["edition"], renderer: "condition" }),
    config("skill", "Skills", "skills", [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("ability", "Ability", "minmax(4rem, .65fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [
        fieldFilter("ability", "Ability"),
        fieldFilter("family", "Family")
    ], { rowSummaryFields: ["family", "edition"], renderer: "skill" }),
    config("houseRule", "House Rules", null, [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [], { rowSummaryFields: ["edition"], renderer: "houseRule" }),
    config("rule", "Other Rules", null, [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ], [], { rowSummaryFields: ["edition"], renderer: "rule" })
];

const CONFIG_BY_ENTITY_TYPE = new Map(FAMILY_CONFIGS.map(value => [value.entityType, value]));
const CONFIG_BY_ROUTE = new Map(FAMILY_CONFIGS
    .filter(value => value.routeFamily)
    .map(value => [value.routeFamily, value]));
const LEGACY_ROUTE_ENTITY_TYPES = new Map([
    ["races", "species"],
    ["subraces", "subspecies"]
]);

export const RULE_FAMILY_TABS = FAMILY_CONFIGS.map(value => [value.entityType, value.label]);

export function getEntityBrowserConfig(entityType = "") {
    const normalized = normalizeEntityType(entityType);
    return CONFIG_BY_ENTITY_TYPE.get(normalized) ?? genericConfig(normalized);
}

export function getEntityBrowserConfigForRoute(routeFamily) {
    const route = String(routeFamily ?? "");
    const direct = CONFIG_BY_ROUTE.get(route);
    if (direct) return direct;
    const alias = LEGACY_ROUTE_ENTITY_TYPES.get(route);
    return alias ? getEntityBrowserConfig(alias) : null;
}

export function getKnownEntityBrowserConfigs() {
    return [...FAMILY_CONFIGS];
}

export function getBrowserFilterDefinitions(entityType = "") {
    return [...SHARED_FILTERS, ...getEntityBrowserConfig(entityType).filters];
}

function config(entityType, label, routeFamily, columns, filters, options = {}) {
    return Object.freeze({
        entityType,
        label,
        routeFamily,
        columns: Object.freeze(columns),
        sortFields: Object.freeze(columns.filter(value => value.sortable).map(value => value.key)),
        filters: Object.freeze(filters),
        rowSummaryFields: Object.freeze(options.rowSummaryFields ?? []),
        renderer: options.renderer ?? (entityType || "generic"),
        relationships: Object.freeze(options.relationships ?? []),
        workspace: options.workspace ?? null
    });
}

function genericConfig(entityType) {
    return config(entityType, humanizeEntityType(entityType), null, DEFAULT_COLUMNS, [], {
        rowSummaryFields: ["edition"],
        renderer: "generic"
    });
}

function column(key, label, width, align = null) {
    return Object.freeze({ key, label, width, align, sortable: true });
}

function filter(key, label, mode, value) {
    return Object.freeze({ key, label, mode, value });
}

function fieldFilter(key, label) {
    return filter(key, label, "client-complete", { kind: "browser-field", field: key });
}

function relationshipFilter(key, label, relationshipKind, relatedEntityType = null) {
    return filter(key, label, "client-complete", {
        kind: "relationship",
        relationshipKind,
        relatedEntityType
    });
}

function speciesColumns() {
    return [
        column("name", "Name", "minmax(9rem, 2fr)"),
        column("ability", "Ability", "minmax(7rem, 1.1fr)"),
        column("size", "Size", "minmax(4rem, .65fr)"),
        column("source", "Source", "minmax(4rem, .65fr)")
    ];
}

function normalizeEntityType(entityType) {
    const value = String(entityType ?? "");
    if (value === "race") return "species";
    if (value === "subrace") return "subspecies";
    return value;
}

function humanizeEntityType(entityType) {
    const value = String(entityType ?? "");
    if (!value) return "All Content";
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}
