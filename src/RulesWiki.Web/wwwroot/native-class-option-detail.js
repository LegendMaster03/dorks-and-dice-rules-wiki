// One presentation for independent class options and their embedded references.
// Every mechanic comes from the native record; unknown fields remain accessible.
const STYLE_ID = "rules-wiki-native-class-styles";
const titleCase = value => String(value).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
const referenceName = id => titleCase(String(id).split(".").at(-1));

export function installClassReferenceStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement("link");
    link.setAttribute("id", STYLE_ID);
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", new URL("./native-class-detail.css", import.meta.url).href);
    document.head.append(link);
}

export function normalizeClassOption(rule) {
    const source = rule.definition && typeof rule.definition === "object" ? rule.definition : rule;
    const definition = source.definition && typeof source.definition === "object"
        ? { ...source, ...source.definition } : { ...source };
    delete definition.definition;
    return { id: rule.id, name: rule.name || source.name || referenceName(rule.id),
        kind: rule.kind || source.kind, definition };
}

export function renderClassOptionContent(rule, { node, renderValue, hrefForRule, embedded = false }) {
    const loaded = normalizeClassOption(rule);
    const { definition: definition, kind } = loaded;
    const root = node("div", { className: "native-class-option-reference" });
    const handled = new Set(["id", "name", "kind", "definition", "description"]);
    const sectionHeading = embedded ? "h5" : "h3";
    const featureHeading = embedded ? "h6" : "h4";
    if (!embedded) {
        root.append(node("header", { className: "native-class-header" },
            node("span", { className: "native-class-eyebrow", text: titleCase(kind || "Class option") }),
            node("h2", { text: loaded.name })));
    }
    const facts = node("dl", { className: "native-class-option-facts" });
    const fact = (key, label, value) => {
        if (value === undefined || value === null) return;
        handled.add(key);
        facts.append(node("div", {}, node("dt", { text: label }),
            node("dd", {}, value instanceof Node ? value : String(value))));
    };
    if (embedded) handled.add("parentClass");
    else if (definition.parentClass && hrefForRule) fact("parentClass", "Class",
        node("a", { text: referenceName(definition.parentClass),
            attributes: { href: hrefForRule(definition.parentClass) } }));
    for (const key of ["availableAtWarlockLevel", "minimumWarlockLevel", "availableAtClassLevel", "minimumClassLevel", "minimumLevel"]) {
        if (Number.isInteger(definition[key])) fact(key, key.includes("Warlock") ? "Warlock level" : "Class level", `${definition[key]}+`);
    }
    if (definition.requiredPact) fact("requiredPact", "Requires Pact", hrefForRule
        ? node("a", { text: referenceName(definition.requiredPact), attributes: { href: hrefForRule(definition.requiredPact) } })
        : referenceName(definition.requiredPact));
    else if (Object.hasOwn(definition, "requiredPact")) handled.add("requiredPact");
    fact("invocationCost", "Invocation cost", definition.invocationCost);
    fact("cost", "Invocation cost", definition.cost);
    if (typeof definition.repeatable === "boolean") fact("repeatable", "Repeatable", definition.repeatable ? "Yes" : "No");
    if (facts.children.length) root.append(facts);
    if (typeof definition.description === "string") root.append(node("p", {
        className: "native-class-option-description", text: definition.description }));

    for (const [key, value] of Object.entries(definition)) {
        const improvement = /^deepenedAtLevel(\d+)$/.exec(key);
        if (!improvement || typeof value !== "string") continue;
        handled.add(key);
        root.append(node("section", { className: "native-class-option-improvement" },
            node(sectionHeading, { text: `Level ${improvement[1]} · Deepened Pact` }), node("p", { text: value })));
    }
    if (Array.isArray(definition.features) && definition.features.every(feature =>
        feature && typeof feature.name === "string" && Number.isInteger(feature.level))) {
        handled.add("features");
        root.append(node("section", { className: "native-class-option-rules" },
            node(sectionHeading, { text: kind === "patron" ? "Patron features" : "Option features" }),
            ...definition.features.map(feature => {
                const section = node("section", { className: "native-class-option-feature" },
                    node(featureHeading, { text: `Level ${feature.level} · ${feature.name}` }));
                if (typeof feature.description === "string") section.append(node("p", { text: feature.description }));
                const extra = Object.fromEntries(Object.entries(feature).filter(([key]) =>
                    !["level", "name", "description"].includes(key)));
                if (Object.keys(extra).length) section.append(renderValue(extra));
                return section;
            })));
    }
    const access = definition.spellAccess;
    if (access && Array.isArray(access.grants) && access.grants.every(grant =>
        Number.isInteger(grant?.level) && Array.isArray(grant.spells))) {
        handled.add("spellAccess");
        const schedule = node("section", { className: "native-class-option-rules" },
            node(sectionHeading, { text: "Spell grants" }));
        if (access.defaultMode === "automatic-known-no-ordinary-selection-cost") {
            schedule.append(node("p", { text: "These spells are automatically known and do not use ordinary spells-known selections." }));
        }
        const table = node("table", { className: "native-class-option-spells" },
            node("thead", {}, node("tr", {}, node("th", { text: "Class level", attributes: { scope: "col" } }),
                node("th", { text: "Spells", attributes: { scope: "col" } }))),
            node("tbody", {}, ...access.grants.map(grant => node("tr", {},
                node("th", { text: grant.level, attributes: { scope: "row" } }),
                node("td", { text: grant.spells.join(", ") })))));
        schedule.append(table);
        const extra = Object.fromEntries(Object.entries(access).filter(([key]) => key !== "grants"
            && !(key === "defaultMode" && access.defaultMode === "automatic-known-no-ordinary-selection-cost")));
        const complete = access.grants.filter(grant => Object.keys(grant).some(key => !["level", "spells"].includes(key)));
        if (complete.length) extra.completeGrantRecords = complete;
        if (Object.keys(extra).length) schedule.append(node("details", { className: "native-class-technical-details" },
            node("summary", { text: "Other spell-access rules and playtest modes" }), renderValue(extra)));
        root.append(schedule);
    }
    const other = Object.fromEntries(Object.entries(definition).filter(([key]) => !handled.has(key)));
    if (Object.keys(other).length) root.append(node("details", { className: "native-class-technical-details" },
        node("summary", { text: "Additional rules and source details" }), renderValue(other)));
    return root;
}
