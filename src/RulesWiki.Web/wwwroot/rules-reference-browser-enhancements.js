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
    if (revision.textContent?.includes("No published rules")) {
        revision.textContent = "Accessible source references";
    }
}
