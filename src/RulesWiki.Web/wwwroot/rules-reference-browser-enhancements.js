import { element } from "./ui.js";
import { normalizeBrowserFieldFilters } from "./rules-browser-filters.js";
import { currentToolRoute, replaceToolRoute } from "./rules-browser-routing.js";
import { referenceCategoryMode } from "./rules-reference-api.js";

export function installWikiReferenceBrowserEnhancements(app) {
    app.api.onReferenceFacetsChanged = () => app.refreshWikiReferenceFacetControls?.();

    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        app.refreshWikiReferenceFacetControls = null;
        await renderActiveView(container);
        if (app.activeView !== "library") return;
        installServerReferenceFacetControls(app, container);
        installCategoryModeControl(app, container);
        clarifyReferenceCatalogStatus(container);
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
    element("option", { value: "any", text: "Category: any variation" }),
    element("option", { value: "effective", text: "Category: effective in this scope" }));
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

    controls.append(element("label", { className: "rules-wiki-category-mode-field" },
        element("span", { className: "visually-hidden", text: "Category membership" }),
        select));
}

function clarifyReferenceCatalogStatus(container) {
    const revision = container.querySelector(".rules-core-library-revision");
    if (!revision) return;
    if (revision.textContent?.includes("Published #reference-catalog")
        || revision.textContent?.includes("No published rules")) {
        revision.textContent = "Accessible source references · no published Rules Layer revision";
    }
}
