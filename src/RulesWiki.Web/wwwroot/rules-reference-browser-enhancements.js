import { element } from "./ui.js";
import { referenceCategoryMode } from "./rules-reference-api.js";

export function installWikiReferenceBrowserEnhancements(app) {
    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        await renderActiveView(container);
        if (app.activeView !== "library") return;
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
