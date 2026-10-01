import { element } from "./ui.js";
import { normalizeBrowserFieldFilters } from "./rules-browser-filters.js";
import { currentToolRoute, replaceToolRoute } from "./rules-browser-routing.js";
import { referenceCategoryMode } from "./rules-reference-api.js";

const SUPPRESSED_MONSTER_MECHANICS = new Set([
    "actiontags",
    "basicrules2024",
    "damagetags",
    "group",
    "languagetags",
    "misctags",
    "referencesources",
    "sensetags",
    "soundclip",
    "srd52"
]);

const BARE_RENDERER_TAG_LABELS = new Map([
    ["h", "Hit:"],
    ["acttrigger", "Trigger:"],
    ["actresponse", "Response:"],
    ["actsave", "Saving Throw:"],
    ["actsavefail", "Failure:"],
    ["actsavesuccess", "Success:"],
    ["actsavefailorsuccess", "Failure or Success:"]
]);

export function installWikiReferenceBrowserEnhancements(app) {
    app.api.onReferenceFacetsChanged = () => app.refreshWikiReferenceFacetControls?.();

    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        app.refreshWikiReferenceFacetControls = null;
        await renderActiveView(container);
        if (app.activeView !== "library") return;
        installServerReferenceFacetControls(app, container);
        installCategoryModeControl(app, container);
        relocateBrowserContextControls(container);
        clarifyReferenceCatalogStatus(container);
        enhanceWikiReferenceFragment(app, container);
    };
}

export function installWikiReferenceNavigation(app) {
    const renderNavigation = app.renderNavigation.bind(app);
    app.renderNavigation = () => {
        const navigation = renderNavigation();
        const buttons = [...navigation.querySelectorAll(".rules-core-nav-menu-item")];
        for (const button of buttons) {
            if (button.textContent?.trim() === "Races") button.remove();
        }

        const species = [...navigation.querySelectorAll(".rules-core-nav-menu-item")]
            .find(button => button.textContent?.trim() === "Species");
        if (species && ![...navigation.querySelectorAll(".rules-core-nav-menu-item")]
            .some(button => button.textContent?.trim() === "Subspecies")) {
            const active = app.activeView === "library"
                && (app.browserFilters?.entityType ?? "") === "subspecies";
            const subspecies = element("button", {
                type: "button",
                className: `rules-core-nav-menu-item${active ? " is-active" : ""}`,
                text: "Subspecies",
                attributes: {
                    role: "menuitem",
                    ...(active ? { "aria-current": "page" } : {})
                },
                onClick: async () => {
                    if (!active) await app.navigateRuleFamily?.("subspecies");
                }
            });
            species.insertAdjacentElement("afterend", subspecies);
        }
        return navigation;
    };

    const presentRenderedFragment = app.presentRenderedFragment?.bind(app);
    if (presentRenderedFragment) {
        app.presentRenderedFragment = container => {
            const result = presentRenderedFragment(container);
            if (app.activeView === "library") enhanceWikiReferenceFragment(app, container);
            return result;
        };
    }
}

function installServerReferenceFacetControls(app, container) {
    const dynamicFilters = container.querySelector(".rules-core-library-filter-fields");
    if (!dynamicFilters) return;

    const packageSelect = createReferenceFacetSelect("Package");
    const editionSelect = createReferenceFacetSelect("Edition");
    const packageField = referenceFacetField("Package", packageSelect);
    const editionField = referenceFacetField("Edition", editionSelect);
    dynamicFilters.insertAdjacentElement("beforebegin", packageField);
    dynamicFilters.insertAdjacentElement("beforebegin", editionField);

    const refresh = () => {
        const selected = app.browserFilters?.fieldFilters ?? {};
        populateReferenceFacetSelect(
            packageSelect,
            app.api.referenceFacets?.package ?? [],
            selected.package ?? "",
            "packages");
        populateReferenceFacetSelect(
            editionSelect,
            app.api.referenceFacets?.edition ?? [],
            selected.edition ?? "",
            "editions");
    };
    app.refreshWikiReferenceFacetControls = refresh;

    bindReferenceFacetChange(app, packageSelect, "package");
    bindReferenceFacetChange(app, editionSelect, "edition");
    refresh();

    // Package and Edition are server-authoritative in the Wiki reference API.
    // The Phase 2 note only applies to the remaining type-specific client filters.
    const availability = container.querySelector(".rules-core-library-filter-note");
    if (availability) availability.style.display = "none";
}

function createReferenceFacetSelect(label) {
    return element("select", {
        className: "form-select form-select-sm rules-wiki-reference-facet",
        ariaLabel: `Filter by ${label.toLowerCase()}`
    });
}

function referenceFacetField(label, select) {
    return element("label", {
        className: "rules-core-library-filter-field rules-wiki-reference-facet-field"
    }, element("span", { text: label }), select);
}

function populateReferenceFacetSelect(select, facets, selectedValue, pluralLabel) {
    select.replaceChildren(element("option", {
        value: "",
        text: `All ${pluralLabel}`
    }));

    let selectedMatched = false;
    for (const facet of facets) {
        const selectedByLegacyDisplayName = selectedValue
            && facet.value !== selectedValue
            && facet.displayName === selectedValue;
        const value = selectedByLegacyDisplayName ? selectedValue : facet.value;
        if (value === selectedValue) selectedMatched = true;
        select.append(element("option", {
            value,
            text: `${facet.displayName || facet.value} (${facet.count})`
        }));
    }

    if (selectedValue && !selectedMatched) {
        select.append(element("option", {
            value: selectedValue,
            text: `${selectedValue} (0)`
        }));
    }
    select.value = selectedValue;
}

function bindReferenceFacetChange(app, select, key) {
    select.addEventListener("change", async () => {
        const next = { ...(app.browserFilters?.fieldFilters ?? {}) };
        if (select.value) next[key] = select.value;
        else delete next[key];
        app.browserFilters.fieldFilters = normalizeBrowserFieldFilters(
            app.browserFilters.entityType,
            next);
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        app.browserSelectedConceptKey = null;
        app.browserDeepLink = null;
        await app.render();
    });
}

function installCategoryModeControl(app, container) {
    const controls = container.querySelector(".rules-core-library-controls");
    if (!controls || controls.querySelector(".rules-wiki-category-mode")) return;

    const select = element("select", {
        className: "form-select form-select-sm rules-wiki-category-mode",
        ariaLabel: "Category membership mode"
    },
    element("option", {
        value: "any",
        text: "Any variation",
        attributes: { "aria-label": "Category: any variation" }
    }),
    element("option", {
        value: "effective",
        text: "Effective in this scope",
        attributes: { "aria-label": "Category: effective in this scope" }
    }));
    select.value = referenceCategoryMode();
    select.addEventListener("change", async () => {
        const parameters = new URLSearchParams(window.location.search);
        if (select.value === "effective") parameters.set("category", "effective");
        else parameters.delete("category");
        const query = parameters.toString();
        const href = `${window.location.pathname}${query ? `?${query}` : ""}`;
        window.history.pushState({}, "", href);
        app.browserSelectedConceptKey = null;
        app.browserDeepLink = null;
        await app.render();
    });

    controls.append(element("label", {
        className: "rules-wiki-browser-context-field rules-wiki-category-mode-field"
    },
    element("span", { className: "rules-wiki-browser-context-label", text: "Category" }),
    select));
}

function relocateBrowserContextControls(container) {
    const controls = container.querySelector(".rules-core-library-controls");
    const index = container.querySelector(".rules-core-library-index");
    if (!controls || !index) return;

    controls.classList.add("rules-wiki-browser-context-controls");
    wrapBrowserContextControl(
        controls.querySelector(".rules-core-library-scope"),
        "Scope");
    wrapBrowserContextControl(
        controls.querySelector(".rules-core-library-more-types"),
        "Type");

    const searchGroup = index.querySelector(":scope > .rules-core-library-search-group");
    if (searchGroup) index.insertBefore(controls, searchGroup);
    else index.prepend(controls);
}

function wrapBrowserContextControl(control, label) {
    if (!control || control.parentElement?.classList.contains("rules-wiki-browser-context-field")) return;
    const wrapper = element("label", { className: "rules-wiki-browser-context-field" },
        element("span", { className: "rules-wiki-browser-context-label", text: label }));
    control.parentNode.insertBefore(wrapper, control);
    wrapper.append(control);
}

function enhanceWikiReferenceFragment(app, container) {
    addReferenceHeading(app, container);
    normalizeRenderedRuleText(container);
    enhanceMonsterReferencePresentation(container);
    collapseSourceSpecificMechanics(container);
    compactReferenceContext(container);
    compactCategoryHistory(container);
    classifyResolutionStatus(container);
}

function addReferenceHeading(app, container) {
    const selectedName = app.root
        ?.querySelector(".rules-core-library-row.is-selected .rules-core-library-row-name")
        ?.textContent
        ?.trim();
    if (!selectedName) return;

    for (const renderer of container.querySelectorAll(".rules-core-structured-rule")) {
        if (renderer.querySelector(":scope > .rules-wiki-reference-heading")) continue;
        renderer.prepend(element("header", { className: "rules-wiki-reference-heading" },
            element("h3", { className: "rules-wiki-reference-title", text: selectedName })));
    }
}

function normalizeRenderedRuleText(container) {
    for (const renderer of container.querySelectorAll(".rules-core-rule-renderer")) {
        const walker = document.createTreeWalker(renderer, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
            const parent = node.parentElement;
            if (!parent || parent.closest("pre, code, .rules-core-secondary-details")) continue;
            const normalized = normalizeVisibleRuleText(node.nodeValue ?? "");
            if (normalized !== node.nodeValue) node.nodeValue = normalized;
        }
    }
}

function normalizeVisibleRuleText(value) {
    let result = String(value ?? "");
    result = result.replace(/\{@([a-zA-Z][\w]*)\}/g, (match, tag) =>
        BARE_RENDERER_TAG_LABELS.get(String(tag).toLowerCase()) ?? match);
    result = result.replace(/^(\s*)m\s+([+-]\d+)(?=,)/i, "$1Melee Attack: $2 to hit");
    result = result.replace(/^(\s*)r\s+([+-]\d+)(?=,)/i, "$1Ranged Attack: $2 to hit");
    return result;
}

function enhanceMonsterReferencePresentation(container) {
    sanitizeMonsterGear(container);
    consumeAdditionalMonsterMechanics(container);
}

function sanitizeMonsterGear(container) {
    for (const list of container.querySelectorAll(".rules-core-monster-stat-block .rules-core-labeled-details")) {
        const pair = findDefinitionPair(list, "gear");
        if (!pair) continue;
        const [, value] = pair;
        const readable = String(value.textContent ?? "")
            .split(",")
            .map(entry => entry.trim().split("|")[0]?.trim())
            .filter(Boolean)
            .join(", ");
        if (readable) value.textContent = readable;
    }
}

function consumeAdditionalMonsterMechanics(container) {
    for (const section of container.querySelectorAll(".rules-core-monster-stat-block .rules-core-additional-mechanics")) {
        const heading = section.querySelector(":scope > .rules-core-monster-section-title");
        if (heading?.textContent?.trim() !== "Additional Mechanics") continue;
        const list = section.querySelector(":scope > .rules-core-additional-mechanics-list");
        if (!list) continue;
        const statBlock = section.closest(".rules-core-monster-stat-block");
        if (!statBlock) continue;

        for (const row of [...list.querySelectorAll(":scope > .rules-core-additional-mechanic")]) {
            const labelNode = row.querySelector(":scope > .rules-core-additional-mechanic-label");
            const valueNode = row.querySelector(":scope > .rules-core-rule-content");
            const label = labelNode?.textContent?.trim() ?? "";
            const key = normalizePresentationKey(label);
            const value = valueNode?.textContent?.trim() ?? "";

            if (key === "passive") {
                presentPassivePerception(statBlock, value);
                row.remove();
                continue;
            }
            if (key === "environment") {
                appendMonsterDetail(statBlock, "Environment", value);
                row.remove();
                continue;
            }
            if (key === "treasure") {
                appendMonsterDetail(statBlock, "Treasure", value);
                row.remove();
                continue;
            }
            if (SUPPRESSED_MONSTER_MECHANICS.has(key)) {
                row.remove();
            }
        }

        if (!list.children.length) {
            section.remove();
            continue;
        }

        heading.remove();
        const body = element("div", { className: "rules-core-secondary-details-body" });
        body.append(...section.childNodes);
        const disclosure = element("details", {
            className: "rules-core-secondary-details rules-wiki-additional-mechanics-disclosure"
        },
        element("summary", { text: "Additional mechanics" }),
        body);
        section.replaceWith(disclosure);
    }
}

function presentPassivePerception(statBlock, value) {
    if (!value) return;
    const list = statBlock.querySelector(".rules-core-monster-details .rules-core-labeled-details");
    const senses = list ? findDefinitionPair(list, "senses") : null;
    if (senses) {
        const [, detail] = senses;
        const current = detail.textContent?.trim() ?? "";
        if (!/passive\s+perception/i.test(current)) {
            detail.textContent = current
                ? `${current}, passive Perception ${value}`
                : `Passive Perception ${value}`;
        }
        return;
    }
    appendMonsterDetail(statBlock, "Passive Perception", value);
}

function appendMonsterDetail(statBlock, label, value) {
    if (!value) return;
    let section = statBlock.querySelector(".rules-core-monster-details");
    let list = section?.querySelector(".rules-core-labeled-details");
    if (!list) {
        section = element("section", { className: "rules-core-monster-details rules-core-monster-section" });
        list = element("dl", { className: "rules-core-labeled-details" });
        section.append(list);
        const anchor = statBlock.querySelector(".rules-core-additional-mechanics, .rules-core-secondary-details");
        if (anchor) statBlock.insertBefore(section, anchor);
        else statBlock.append(section);
    }
    if (findDefinitionPair(list, normalizePresentationKey(label))) return;
    list.append(
        element("dt", { text: label }),
        element("dd", { text: value }));
}

function findDefinitionPair(list, normalizedLabel) {
    const children = [...list.children];
    for (let index = 0; index < children.length - 1; index += 1) {
        const label = children[index];
        const value = children[index + 1];
        if (label.tagName !== "DT" || value.tagName !== "DD") continue;
        if (normalizePresentationKey(label.textContent) === normalizedLabel) return [label, value];
    }
    return null;
}

function compactReferenceContext(container) {
    for (const card of [...container.querySelectorAll(".rules-core-detail-context-card")]) {
        const heading = card.querySelector(":scope > h3");
        if (heading?.textContent?.trim() !== "Reference context") continue;
        const list = card.querySelector(":scope > dl");
        if (!list) continue;

        const technical = element("dl");
        const children = [...list.children];
        for (let index = 0; index < children.length - 1; index += 1) {
            const label = children[index];
            const value = children[index + 1];
            if (label.tagName !== "DT" || value.tagName !== "DD") continue;
            const key = normalizePresentationKey(label.textContent);
            if (key === "scope" || key === "effectivecategory") {
                label.remove();
                value.remove();
                continue;
            }
            if (key === "effectiveedition") {
                label.textContent = "Edition";
                continue;
            }
            if (key === "package" || key === "referenceidentity") {
                technical.append(label, value);
            }
        }

        const body = element("div", { className: "rules-core-context-disclosure-body" });
        if (list.children.length) body.append(list);
        if (technical.children.length) {
            body.append(element("details", { className: "rules-core-secondary-details" },
                element("summary", { text: "Technical identifiers" }),
                element("div", { className: "rules-core-secondary-details-body" }, technical)));
        }
        const disclosure = element("details", {
            className: "rules-core-context-disclosure rules-wiki-reference-metadata-disclosure"
        },
        element("summary", { text: "Source and reference metadata" }),
        body);
        card.replaceWith(disclosure);
    }
}

function compactCategoryHistory(container) {
    for (const card of [...container.querySelectorAll(".rules-core-detail-context-card")]) {
        const heading = card.querySelector(":scope > h3");
        if (heading?.textContent?.trim() !== "Category history") continue;
        const entries = [...card.querySelectorAll(":scope > ul > li")];
        const uniqueCategories = new Set(entries
            .map(entry => normalizePresentationKey((entry.textContent ?? "").split("·")[0]))
            .filter(Boolean));
        if (uniqueCategories.size <= 1) {
            card.remove();
            continue;
        }

        heading.remove();
        const body = element("div", { className: "rules-core-context-disclosure-body" });
        body.append(...card.childNodes);
        const disclosure = element("details", {
            className: "rules-core-context-disclosure rules-wiki-category-history-disclosure"
        },
        element("summary", { text: "Category history" }),
        body);
        card.replaceWith(disclosure);
    }
}

function collapseSourceSpecificMechanics(container) {
    for (const section of container.querySelectorAll(".rules-core-source-mechanics")) {
        if (section.closest(".rules-wiki-source-mechanics-disclosure")) continue;
        section.querySelector(":scope > .rules-core-monster-section-title")?.remove();
        const body = element("div", { className: "rules-core-secondary-details-body" });
        body.append(...section.childNodes);
        const disclosure = element("details", {
            className: "rules-core-secondary-details rules-wiki-source-mechanics-disclosure"
        },
        element("summary", { text: "Source-specific mechanics" }),
        body);
        section.replaceWith(disclosure);
    }
}

function classifyResolutionStatus(container) {
    for (const status of container.querySelectorAll(".rules-core-ruling-status")) {
        const title = status.querySelector(".rules-core-ruling-status-title")?.textContent?.trim();
        status.classList.toggle("is-unresolved", title === "Unresolved default");
        for (const scopeBadge of status.querySelectorAll(".badge")) {
            if (["Global scope", "Campaign scope"].includes(scopeBadge.textContent?.trim())) {
                scopeBadge.remove();
            }
        }
    }
}

function normalizePresentationKey(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function clarifyReferenceCatalogStatus(container) {
    const revision = container.querySelector(".rules-core-library-revision");
    if (!revision) return;
    if (revision.textContent?.includes("Published #reference-catalog")
        || revision.textContent?.includes("No published rules")) {
        revision.textContent = "Accessible source references · no published Rules Layer revision";
    }
}
