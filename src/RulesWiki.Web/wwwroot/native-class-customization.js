import { renderClassOptionContent } from "./native-class-option-detail.js";
// Class customization reference surfaces. Every linked system, option, and
// preset resolves by native rule identity; file placement is not a UI contract.
// No selections or preset composition are inferred from display metadata.
const NATIVE_ID = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
// This is a compatibility mapping for the *published* selectionRules keys,
// not a required three-pillar model for future base classes.
const SELECTION_RULE_CATEGORIES = {
    patron: "patron", pact: "pact", invocations: "invocation"
};
const SYSTEM_DESCRIPTIONS = {
    patron: "The source of your Warlock's supernatural power. Choose a Patron at level 1.",
    pact: "The form your agreement takes. Choose one Pact at level 1; it shapes your abilities and compatible Invocations.",
    invocations: "Additional terms attached to your Pact. Choose options as your Warlock advances, subject to prerequisites."
};
function describeRequirement(key, value) {
    if (value === false || value === null || value === undefined) return null;
    if (key === "requiredAtWarlockLevel" || key === "firstChoiceAtWarlockLevel")
        return `Available at Warlock level ${value}`;
    if (key === "firstChoiceFree" && value === true) return "Your first Pact does not cost an Invocation selection.";
    if (key === "everyChoiceAttachedToOneActualPact" && value === true)
        return "Each Invocation attaches to a Pact you possess.";
    if (key === "patronAcceptanceRequired" && value === true)
        return "Your Patron must accept the Invocation.";
    if (key === "identityMayBeInheritedOrUnknown" && value === true)
        return "A Patron may be inherited or unknown to the Warlock.";
    if (key === "playtestPatronId" && typeof value === "string")
        return `Current playtest Patron: ${displayOptionId(value)}`;
    if (key === "extraPacts" && value === "out-of-scope")
        return "Additional Pacts are outside this playtest.";
    if (key === "replacement" && value === "one-on-warlock-level-up")
        return "Replace one Invocation when gaining a Warlock level.";
    if (key === "severance" && value === "suspend-without-refund")
        return "Severed Pact Invocations are suspended without an automatic refund.";
    return null;
}
function displayRequirements(node, renderValue, properties) {
    const entries = Object.entries(properties ?? {});
    const explained = entries.map(([key, value]) => [key, describeRequirement(key, value)]);
    const notes = explained.filter(([, text]) => text).map(([, text]) =>
        node("li", { text }));
    const unhandled = Object.fromEntries(entries.filter(([key]) =>
        !explained.some(([known, text]) => known === key && text)));
    return [
        ...(notes.length ? [node("ul", { className: "native-class-system-notes" }, notes)] : []),
        ...(Object.keys(unhandled).length ? [node("details", { className: "native-class-technical-details" },
            node("summary", { text: "Further rules and conditions" }), renderValue(unhandled))] : [])
    ];
}

function formatName(key) {
    return String(key).replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function displayOptionId(id) {
    return formatName(String(id).split(".").at(-1));
}

function linkedOptions(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(option => typeof option === "string" ? { id: option } : option)
        .filter(option => option && typeof option.id === "string" && NATIVE_ID.test(option.id))
        .filter(option => !seen.has(option.id) && seen.add(option.id))
        .map(option => ({
            id: option.id,
            name: typeof option.name === "string" ? option.name : null,
            ...(Number.isInteger(option.minimumLevel) ? { minimumLevel: option.minimumLevel } : {}),
            ...(Object.hasOwn(option, "requiredPact") &&
                (option.requiredPact === null || NATIVE_ID.test(option.requiredPact))
                ? { requiredPact: option.requiredPact } : {})
        }));
}

function systemFromObject(name, item) {
    const idGroups = Object.entries(item).filter(([key, value]) =>
        /^active[A-Z].*Ids$/.test(key) && Array.isArray(value)
        && value.every(id => typeof id === "string"));
    const options = linkedOptions([
        ...(Array.isArray(item.optionIds) ? item.optionIds : []),
        ...(Array.isArray(item.options) ? item.options : []), ...idGroups.flatMap(([, ids]) => ids)
    ]);
    return {
        id: typeof item.id === "string" && NATIVE_ID.test(item.id) ? item.id : null,
        name: name || item.name || item.title || "Customization system",
        category: typeof item.category === "string" ? item.category : null,
        options,
        properties: Object.fromEntries(Object.entries(item).filter(([key]) =>
            !["id", "name", "title", "category", "optionIds", "options"].includes(key)
            && !idGroups.some(([idKey]) => idKey === key)))
    };
}

function normalizedSystems(definition) {
    // The source may supply inline presentation metadata or references to
    // separately authored systems. This adapter does not require either shape.
    if (Array.isArray(definition.customizationSystems)) {
        return definition.customizationSystems.map((value, index) =>
            typeof value === "string" && NATIVE_ID.test(value)
                ? { id: value, name: displayOptionId(value), options: [], properties: {} }
                : value && typeof value === "object"
                    ? systemFromObject(value.name || value.title || `System ${index + 1}`, value) : null)
            .filter(Boolean);
    }
    if (definition.customizationSystems && typeof definition.customizationSystems === "object") {
        return Object.entries(definition.customizationSystems)
            .filter(([, item]) => item && typeof item === "object")
            .map(([name, item]) => systemFromObject(formatName(name), item));
    }
    if (Array.isArray(definition.customizationSystemIds)) {
        return linkedOptions(definition.customizationSystemIds).map(({ id, name }) => ({
            id, name: name || displayOptionId(id), options: [], properties: {}
        }));
    }
    // The reorganized native Warlock supplies selection rules, not option
    // lists. Its separately authored options identify the owner by parentClass.
    // Other class systems require an explicit category or system reference;
    // never infer membership from file paths or a class-name prefix.
    if (definition.selectionRules && typeof definition.selectionRules === "object") {
        return Object.entries(definition.selectionRules)
            .filter(([, item]) => item && typeof item === "object" && !Array.isArray(item))
            .map(([key, item]) => ({
                ...systemFromObject(formatName(key), item),
                category: SELECTION_RULE_CATEGORIES[key] ?? null
            }));
    }
    // Transitional Warlock content uses pillarSystem. These are already IDs
    // of independent native rules; no file location or other class's pillars
    // are assumed by this compatibility adapter.
    if (definition.pillarSystem && typeof definition.pillarSystem === "object") {
        return Object.entries(definition.pillarSystem)
            .filter(([, item]) => item && typeof item === "object")
            .map(([name, item]) => systemFromObject(formatName(name), item));
    }
    return [];
}

function findPresets(definition) {
    // A named Patron is not itself a subclass preset. Only explicit
    // membership in a preset reference list constitutes a preset.
    const embedded = Array.isArray(definition.subclassPresets) ? definition.subclassPresets : [];
    const linked = Array.isArray(definition.subclassPresetIds) ? definition.subclassPresetIds : [];
    return [...embedded, ...linked].map(value => typeof value === "string" ? { id: value } : value)
        .filter(value => value && typeof value === "object" &&
            (typeof value.name === "string" || (typeof value.id === "string" && NATIVE_ID.test(value.id))));
}

function unwrapRule(result, id) {
    const rule = result?.rule;
    if (!rule || rule.id !== id) throw new Error("The requested native rule was not returned.");
    const source = rule.definition && typeof rule.definition === "object" ? rule.definition : rule;
    // Some native entities wrap gameplay fields in a nested definition while
    // keeping prerequisites, status and relationship data on the outer record.
    // Both layers are authoritative and must remain visible in the reference.
    const definition = source.definition && typeof source.definition === "object"
        ? { ...source, ...source.definition } : { ...source };
    delete definition.definition;
    return { name: rule.name || source.name || displayOptionId(id), kind: rule.kind || source.kind, definition };
}

/**
 * Discover options owned by one class using the public native reference
 * contract: category-filtered catalog pages, followed by parentClass checks
 * on the authoritative individual records. No filesystem paths or ID-prefix
 * guesses are used as evidence of ownership.
 *
 * Only invoked when the user expands an applicable customization system.
 */
export async function discoverOwnedOptions(category, classId, {
    searchRules, getRule, fingerprint = null
}) {
    if (!NATIVE_ID.test(classId) || typeof searchRules !== "function"
        || typeof getRule !== "function") throw new Error("Native option discovery is unavailable.");
    const summaries = [];
    let offset = 0;
    let total = null;
    do {
        const page = await searchRules({ category, limit: 100, offset });
        if (!Array.isArray(page?.rules) || !Number.isInteger(page.total) || page.total < 0
            || (fingerprint && page.fingerprint !== fingerprint)) {
            throw new Error("Native option catalog changed or returned invalid results.");
        }
        if (total !== null && total !== page.total) {
            throw new Error("Native option catalog changed during loading.");
        }
        total = page.total;
        if (!page.rules.length && offset < total) {
            throw new Error("Native option catalog returned an incomplete page.");
        }
        for (const rule of page.rules) {
            if (rule && rule.kind === category && NATIVE_ID.test(rule.id)) summaries.push(rule);
        }
        offset += page.rules.length;
    } while (offset < total);

    const owned = [];
    // Throttle individual reads: the catalog does not yet expose parentClass
    // in its summaries, so the UI must verify each candidate's ownership.
    for (let start = 0; start < summaries.length; start += 6) {
        const resolved = await Promise.all(summaries.slice(start, start + 6).map(async summary => {
            const response = await getRule(summary.id);
            if (fingerprint && response?.fingerprint !== fingerprint) {
                throw new Error("Native option catalog changed during loading.");
            }
            const loaded = unwrapRule(response, summary.id);
            return loaded.definition.parentClass === classId
                ? { id: summary.id, name: loaded.name,
                    minimumLevel: loaded.definition.minimumWarlockLevel ?? loaded.definition.availableAtWarlockLevel
                        ?? loaded.definition.minimumClassLevel ?? loaded.definition.availableAtClassLevel ?? null,
                    requiredPact: loaded.definition.requiredPact ?? null,
                    description: loaded.definition.description ?? null } : null;
        }));
        owned.push(...resolved.filter(Boolean));
    }
    return owned;
}

function appendRuleLink(container, id, { node, hrefForRule }) {
    container.append(node("a", { className: "native-class-rule-link", text: "View full reference", attributes: { href: hrefForRule(id) } }));
}

function renderOption(option, dependencies) {
    if (dependencies.compactOverview) {
        const { node, hrefForRule } = dependencies;
        return node("li", { className: "native-class-customization-option",
            attributes: { "data-option-id": option.id } },
            node("article", { className: "native-class-option-overview" }, node("h4", { text: option.name || displayOptionId(option.id) }),
            ...(option.description ? [node("p", { text: option.description })] : []),
            node("a", { className: "native-class-rule-link", text: `View ${option.name || displayOptionId(option.id)}`,
                attributes: { href: hrefForRule(option.id) } })));
    }
    const { node, renderValue, getRule } = dependencies;
    const { id } = option;
    const name = option.name || displayOptionId(id);
    const row = node("li", { className: "native-class-customization-option", attributes: { "data-option-id": id } });
    const displayName = node("summary", {}, node("strong", { text: name }),
        ...(option.minimumLevel !== null && option.minimumLevel !== undefined
            ? [node("span", { className: "native-class-option-meta", text: `Level ${option.minimumLevel}+` })] : []),
        ...(option.requiredPact ? [node("span", { className: "native-class-option-meta",
            text: `Requires ${displayOptionId(option.requiredPact)}` })] : []));
    const disclosure = node("details", { className: "native-class-customization-option-detail" }, displayName);
    const detail = node("div", { className: "native-class-customization-option-body" });
    if (typeof getRule === "function") {
        let requested = false;
        disclosure.addEventListener("toggle", () => {
            if (!disclosure.open || requested) return;
            requested = true;
            detail.replaceChildren(node("p", { text: "Loading native option…" }));
            Promise.resolve().then(() => getRule(id)).then(result => {
                const loaded = unwrapRule(result, id);
                const title = displayName.querySelector?.("strong");
                if (title) title.textContent = loaded.name;
                else displayName.textContent = loaded.name;
                row.setAttribute("data-option-title", loaded.name);
                detail.replaceChildren(node("a", { className: "native-class-rule-link",
                    text: `View ${loaded.name} full reference`, attributes: { href: dependencies.hrefForRule(id) } }),
                    renderClassOptionContent({ id, name: loaded.name, kind: loaded.kind,
                        definition: loaded.definition }, { ...dependencies, embedded: true }));
            }).catch(() => {
                requested = false;
                detail.replaceChildren(node("p", { text:
                    "Option detail unavailable. Close and reopen to retry, or open the full native rule." }));
                appendRuleLink(detail, id, dependencies);
            });
        });
    } else {
        detail.append(node("p", { text: "Open the native rule for its complete definition." }));
    }
    if (typeof getRule !== "function") appendRuleLink(detail, id, dependencies);
    disclosure.append(detail);
    row.append(disclosure);
    return row;
}

// Filters are exploratory reference aids. They do not test or commit a legal
// character build; Core remains responsible for option eligibility.
function renderOptionList(options, systemName, dependencies) {
    const { node, maximumClassLevel } = dependencies;
    const smallSystem = dependencies.compactOverview || dependencies.category === "pact"
        || systemName.toLowerCase() === "pact";
    if (smallSystem) return [node("ul", { className: "native-class-customization-options" },
        ...options.map(option => renderOption(option, dependencies)))];
    const result = node("p", { className: "native-class-help", attributes: { role: "status", "aria-live": "polite" } });
    const search = node("input", { attributes: { type: "search",
        "aria-label": `Filter ${systemName} options by name`, placeholder: `Search ${systemName.toLowerCase()}` } });
    const controls = node("div", { className: "native-class-option-filters" },
        node("label", { className: "native-class-filter-field" },
            node("span", { text: "Search by name" }), search));
    const levels = options.map(option => option.minimumLevel)
        .filter(level => Number.isInteger(level) && level >= 1);
    let levelFilter = null;
    if (levels.length) {
        const lastLevel = Math.max(1,
            ...(Number.isInteger(maximumClassLevel) && maximumClassLevel > 0 ? [maximumClassLevel] : []),
            ...levels);
        levelFilter = node("select", { attributes: { "aria-label": `Show ${systemName} options by documented class level` } },
            node("option", { text: "All levels", attributes: { value: "" } }),
            ...Array.from({ length: lastLevel }, (_, index) => node("option", {
                text: `Level ${index + 1}`, attributes: { value: index + 1 }
            })));
        controls.append(node("label", { className: "native-class-filter-field" },
            node("span", { text: "Available by class level" }), levelFilter));
    }
    const pactIds = [...new Set(options.map(option => option.requiredPact)
        .filter(id => typeof id === "string" && NATIVE_ID.test(id)))].sort();
    let pactFilter = null;
    if (pactIds.length) {
        pactFilter = node("select", { attributes: { "aria-label": `Filter ${systemName} by required Pact` } },
            node("option", { text: "All Pact requirements", attributes: { value: "" } }),
            node("option", { text: "No listed Pact prerequisite", attributes: { value: "none" } }),
            ...pactIds.map(id => node("option", {
                text: `Requires ${displayOptionId(id)}`, attributes: { value: id }
            })));
        controls.append(node("label", { className: "native-class-filter-field" },
            node("span", { text: "Pact prerequisite" }), pactFilter));
    }
    const list = node("ul", { className: "native-class-customization-options" },
        ...options.map(option => renderOption(option, dependencies)));
    const initialLimit = 12;
    let showAll = options.length <= initialLimit;
    const showButton = options.length > initialLimit ? node("button", {
        text: `Show all ${options.length} options`, className: "native-class-show-all",
        attributes: { type: "button", "aria-expanded": "false" }
    }) : null;
    const applyFilter = () => {
        const query = String(search.value ?? "").trim().toLowerCase();
        const level = levelFilter?.value ? Number(levelFilter.value) : null;
        const pact = pactFilter?.value || "";
        const filtersActive = Boolean(query || level !== null || pact);
        const matching = options.map((option, index) => {
            const matchesName = !query || option.id.toLowerCase().includes(query)
                || (option.name || displayOptionId(option.id)).toLowerCase().includes(query)
                || String(list.children[index].getAttribute("data-option-title") || "").toLowerCase().includes(query);
            const matchesLevel = level === null || !Number.isInteger(option.minimumLevel)
                || option.minimumLevel <= level;
            const matchesPact = !pact || (pact === "none" ? !option.requiredPact : option.requiredPact === pact);
            return matchesName && matchesLevel && matchesPact;
        });
        const total = matching.filter(Boolean).length;
        let visible = 0;
        for (let index = 0; index < list.children.length; index += 1) {
            const item = list.children[index];
            item.hidden = !matching[index] || (!filtersActive && !showAll && visible >= initialLimit);
            if (!item.hidden) visible++;
        }
        result.textContent = `${visible} shown · ${total} matching · ${options.length} total`;
        if (showButton) showButton.hidden = filtersActive;
    };
    if (showButton) showButton.addEventListener("click", () => {
        showAll = !showAll;
        showButton.textContent = showAll ? "Show fewer options" : `Show all ${options.length} options`;
        showButton.setAttribute("aria-expanded", String(showAll));
        applyFilter();
    });
    search.addEventListener("input", applyFilter);
    levelFilter?.addEventListener("change", applyFilter);
    pactFilter?.addEventListener("change", applyFilter);
    applyFilter();
    const guidance = (levelFilter || pactFilter) ? node("p", { className: "native-class-help", text:
        "Shows options whose listed minimum level is at or below the selected class level. Other prerequisites still apply; this is not a character eligibility check." }) : null;
    return [controls, guidance, result, list, showButton].filter(Boolean);
}

function renderSystem(system, dependencies) {
    const { node, renderValue, getRule } = dependencies;
    const summaryName = node("strong", { text: system.name });
    const summaryCount = node("span", { className: "native-class-system-count",
        text: system.id ? "Linked native system" : system.options.length
            ? `${system.options.length} referenced options` : "Rules and requirements" });
    const description = SYSTEM_DESCRIPTIONS[system.category] ??
        SYSTEM_DESCRIPTIONS[String(system.name).toLowerCase()] ?? "Explore options and rules for this class-specific system.";
    const wrapper = node("details", { className: "native-class-customization-system" },
        node("summary", {}, node("span", { className: "native-class-system-heading" },
            summaryName, node("span", { className: "native-class-system-description", text: description })),
            summaryCount));
    const body = node("div", { className: "native-class-customization-system-body" });
    const show = (name, options, properties) => {
        body.replaceChildren();
        summaryName.textContent = name;
        summaryCount.textContent = options.length ? `${options.length} ${options.length === 1 ? "option" : "options"}` : "Rules and requirements";
        if (properties && Object.keys(properties).length) {
            body.append(node("div", { className: "native-class-system-properties" },
                ...displayRequirements(node, renderValue, properties)));
        }
        if (options.length && system.category === "invocation") {
            const dedicated = new Map();
            for (const option of options) {
                const key = typeof option.requiredPact === "string" ? option.requiredPact : "unspecified";
                dedicated.set(key, (dedicated.get(key) ?? 0) + 1);
            }
            const groups = [...dedicated].sort(([a], [b]) => a.localeCompare(b));
            body.append(node("div", { className: "native-class-prerequisite-overview" },
                node("strong", { text: "Pact relationships" }),
                node("p", { className: "native-class-help", text:
                    "The options below list documented Pact prerequisites. Each selected Invocation still attaches to a Pact under the class rules." }),
                node("ul", {}, ...groups.map(([id, count]) => node("li", {},
                    node("span", { text: id === "unspecified" ? "No specific Pact listed" : `Requires ${displayOptionId(id)}` }),
                    node("strong", { text: String(count) }))))));
        }
        if (options.length) body.append(...renderOptionList(options, name, { ...dependencies,
            category: system.category,
            compactOverview: system.category === "patron" || name.toLowerCase() === "patron" }));
        if (system.id) appendRuleLink(body, system.id, dependencies);
        wrapper.setAttribute("data-options-ready", "true");
        dependencies.onOptionsRendered?.();
    };
    if (!system.id && system.category && !system.options.length
        && typeof dependencies.discoverOptions === "function") {
        const initial = node("p", { className: "native-class-help",
            text: "Expand to discover the separately authored native options for this class." });
        body.append(initial);
        let requested = false;
        wrapper.addEventListener("toggle", () => {
            if (!wrapper.open || requested) return;
            requested = true;
            body.replaceChildren(node("p", { text: "Loading related native options…" }));
            Promise.resolve().then(() => dependencies.discoverOptions(system.category)).then(options => {
                show(system.name, options, system.properties);
                if (!options.length) body.append(node("p", { className: "native-class-help",
                    text: "No independently authored options were found for this class." }));
            }).catch(() => {
                requested = false;
                body.replaceChildren(node("p", { text:
                    "Related options could not be loaded. Close and reopen this section to retry." }));
            });
        });
    } else if (system.id) {
        body.append(node("p", { text: "Expand to load the independent native system definition." }));
        appendRuleLink(body, system.id, dependencies);
        let requested = false;
        wrapper.addEventListener("toggle", () => {
            if (!wrapper.open || requested || typeof getRule !== "function") return;
            requested = true;
            body.replaceChildren(node("p", { text: "Loading native customization system…" }));
            Promise.resolve().then(() => getRule(system.id)).then(result => {
                const loaded = unwrapRule(result, system.id);
                const source = loaded.definition;
                const fromSource = systemFromObject(loaded.name, source);
                const properties = { ...fromSource.properties, ...system.properties };
                for (const key of ["kind", "parentClass", "definition"]) delete properties[key];
                if (Array.isArray(source.options) && source.options.length && !fromSource.options.length) {
                    properties.unlinkedOptions = source.options;
                }
                show(loaded.name, fromSource.options.length ? fromSource.options : system.options, properties);
            }).catch(() => {
                requested = false;
                body.replaceChildren(node("p", { text:
                    "System details unavailable. Close and reopen to retry, or open the full native rule." }));
                appendRuleLink(body, system.id, dependencies);
            });
        });
    } else {
        show(system.name, system.options, system.properties);
    }
    wrapper.append(body);
    if (!system.id && !system.category && system.options.length && system.options.length <= 4) wrapper.open = true;
    return wrapper;
}

function renderPreset(preset, dependencies) {
    const { node, renderValue, getRule } = dependencies;
    const referenceOnly = typeof preset.id === "string" && NATIVE_ID.test(preset.id)
        && !["choices", "choiceIds", "selections", "components", "configuration"].some(key =>
            preset[key] !== undefined);
    const card = node("article", { className: "native-class-preset" });
    const title = node("h5", { text: preset.name || displayOptionId(preset.id) });
    card.append(title);
    if (referenceOnly) {
        if (preset.description) card.append(node("p", { text: preset.description }));
        const disclosure = node("details", {}, node("summary", { text: "View preset rules" }));
        const content = node("div");
        appendRuleLink(content, preset.id, dependencies);
        let requested = false;
        disclosure.addEventListener("toggle", () => {
            if (!disclosure.open || requested || !getRule) return;
            requested = true;
            content.replaceChildren(node("p", { text: "Loading native preset…" }));
            Promise.resolve().then(() => getRule(preset.id)).then(result => {
                const loaded = unwrapRule(result, preset.id);
                title.textContent = loaded.name;
                content.replaceChildren(renderValue(loaded.definition));
                appendRuleLink(content, preset.id, dependencies);
            }).catch(() => {
                requested = false;
                content.replaceChildren(node("p", { text:
                    "Preset details unavailable. Close and reopen to retry, or open the full native rule." }));
                appendRuleLink(content, preset.id, dependencies);
            });
        });
        disclosure.append(content);
        card.append(disclosure);
    } else {
        if (preset.description) card.append(node("p", { text: preset.description }));
        const componentKeys = ["choices", "choiceIds", "selections", "components", "configuration"];
        const defined = componentKeys.filter(key => preset[key] !== undefined);
        if (defined.length) {
            const list = node("dl", { className: "native-class-preset-selections" });
            for (const key of defined) {
                list.append(node("div", {}, node("dt", { text: formatName(key) }),
                    node("dd", {}, renderValue(preset[key]))));
            }
            card.append(list, node("p", { className: "native-class-help", text:
                "Only the choices explicitly defined by this preset are specified here. Other required selections remain governed by the class systems." }));
        }
        const extra = Object.fromEntries(Object.entries(preset).filter(([key]) =>
            !["id", "name", "description", ...componentKeys].includes(key)));
        if (Object.keys(extra).length) card.append(node("details", { className: "native-class-technical-details" },
            node("summary", { text: "Other preset rules" }), renderValue(extra)));
        if (preset.id && NATIVE_ID.test(preset.id)) appendRuleLink(card, preset.id, dependencies);
    }
    return card;
}

function renderPublishedSelections(key, source, { node, renderValue }) {
    if (!source || typeof source !== "object") return null;
    const section = node("section", { className: "native-class-published-selections" });
    if (key === "wizardSpecialization" && Array.isArray(source.classLevelGrants)
        && Array.isArray(source.eligibleOptionFamilies)) {
        section.append(node("p", { text:
            `At Wizard levels ${source.classLevelGrants.join(", ")}, choose ${source.selectionsPerClassLevelGrant ?? 1} eligible specialization option per grant from ${source.eligibleOptionFamilies.map(formatName).join(" or ")}.` }));
        if (source.additionalToOtherClassGrants === true)
            section.append(node("p", { text: "These specialization choices are additional to other class grants." }));
        if (source.optionPrerequisitesApply === true)
            section.append(node("p", { text: "Each option's own prerequisites apply." }));
        if (source.ordinaryGeneralFeatMayBeReplacedByOneEligibleSpecializationOption === true)
            section.append(node("p", { text: "An ordinary general feat choice may instead be used for an eligible specialization option, consuming that feat choice." }));
        if (source.underlyingMetamagicAndCraftingDetails === "deferred-to-shared-mechanics")
            section.append(node("p", { text: "Shared Metamagic and crafting mechanics remain deferred; this entry does not define their effects." }));
        if (source.doesNotGrantSorceryPoints === true && source.doesNotGrantSorcererMetamagicClassFeature === true)
            section.append(node("p", { text: "This specialization does not grant Sorcery Points or the Sorcerer Metamagic class feature." }));
    } else if (key === "companionPathChoice" && Array.isArray(source.paths)
        && Number.isInteger(source.selectionFromWizardLevel)) {
        section.append(node("p", { text:
            `Beginning at Wizard level ${source.selectionFromWizardLevel}, choose ${source.exclusive === true ? "one exclusive path" : "a path"}: ${source.paths.map(formatName).join(" or ")}.` }));
        if (source.implementation === "deferred-to-shared-companion-system")
            section.append(node("p", { text: "The shared companion mechanics remain deferred; no companion powers are supplied by this reference." }));
    } else return null;
    section.append(node("details", { className: "native-class-technical-details" },
        node("summary", { text: "Complete published selection data" }), renderValue(source)));
    return section;
}

export function renderClassCustomizations(definition, dependencies) {
    const { node, renderValue, fallbackFields } = dependencies;
    const systems = normalizedSystems(definition);
    const presets = findPresets(definition);
    const extras = fallbackFields.filter(([, key]) => definition[key] !== undefined && definition[key] !== null
        && key !== "customizationSystems" && key !== "subclassPresets");
    if (!systems.length && !presets.length && !extras.length && !definition.subclasses) return null;
    const wrapper = node("section", { className: "native-class-section native-class-customization",
        attributes: { id: "native-class-customization" } },
        node("h3", { text: "Class customization" }));
    if (systems.length) {
        wrapper.append(node("p", { className: "native-class-help", text:
            "Explore how this class is configured. These are rule references, not a character builder." }));
        const panels = systems.map(system => renderSystem(system, dependencies));
        // Show the first customization system without requiring a second click.
        // Independent rule discovery still happens only when that panel opens.
        if (panels.length) panels[0].open = true;
        wrapper.append(...panels);
    }
    if (systems.length && !presets.length) {
        wrapper.append(node("p", { className: "native-class-help native-class-preset-empty", text:
            "No traditional subclass presets are defined in this class record yet. Individual customization options are not automatically complete presets." }));
    }
    if (presets.length) {
        wrapper.append(node("section", { className: "native-class-presets" },
            node("h4", { text: "Traditional subclass presets" }),
            node("p", { className: "native-class-help", text:
                "Presets specify only their listed customization choices; remaining choices stay independent." }),
            ...presets.map(preset => renderPreset(preset, dependencies))));
    }
    for (const [heading, key] of extras) {
        wrapper.append(node("div", { className: "native-class-option-family" },
            node("h4", { text: heading }),
            renderPublishedSelections(key, definition[key], dependencies) ?? renderValue(definition[key])));
    }
    if (typeof definition.subclasses === "string") {
        wrapper.append(node("p", { className: "native-class-help", text:
            `Subclass content: ${formatName(definition.subclasses)}. This is not an available preset list.` }));
    } else if (definition.subclasses && typeof definition.subclasses === "object") {
        wrapper.append(node("div", { className: "native-class-option-family" },
            node("h4", { text: "Existing subclass references" }), renderValue(definition.subclasses)));
    }
    return wrapper;
}
