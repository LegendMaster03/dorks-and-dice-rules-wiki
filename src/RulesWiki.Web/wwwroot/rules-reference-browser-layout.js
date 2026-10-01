export function installImmediateReferenceBrowserLayout(app) {
    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        const isReferenceBrowser = app.activeView === "library";
        const rendering = renderActiveView(container);

        // The browser shell is built synchronously before its first data-load await. Move the
        // context controls immediately so the legacy split-toolbar position is never painted while
        // the reference catalog is loading.
        if (isReferenceBrowser) placeReferenceBrowserControls(container);

        await rendering;
    };
}

export function placeReferenceBrowserControls(container) {
    const controls = container.querySelector(".rules-core-library-controls");
    const index = container.querySelector(".rules-core-library-index");
    if (!controls || !index) return;

    controls.classList.add("rules-wiki-browser-context-controls");
    wrapContextControl(
        controls.querySelector(".rules-core-library-scope"),
        "Scope");
    wrapContextControl(
        controls.querySelector(".rules-core-library-more-types"),
        "Type");

    const searchGroup = index.querySelector(":scope > .rules-core-library-search-group");
    if (searchGroup) index.insertBefore(controls, searchGroup);
    else index.prepend(controls);
}

function wrapContextControl(control, label) {
    if (!control || control.parentElement?.classList.contains("rules-wiki-browser-context-field")) return;

    const wrapper = document.createElement("label");
    wrapper.className = "rules-wiki-browser-context-field";
    const caption = document.createElement("span");
    caption.className = "rules-wiki-browser-context-label";
    caption.textContent = label;
    wrapper.append(caption);
    control.parentNode.insertBefore(wrapper, control);
    wrapper.append(control);
}
