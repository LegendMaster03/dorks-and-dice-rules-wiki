// Session-scoped reading state only: no character choices or rule definitions.
// Consume on return to the same class/snapshot, and restore lazy sections through
// their explicit render hook rather than observing arbitrary DOM mutations.
export function createClassReturnState(root, { classId, fingerprint }) {
    const storageKey = "rulesWikiClassReturn";
    let saved = null;
    try {
        const candidate = JSON.parse(window.sessionStorage.getItem(storageKey));
        if (candidate?.version === 1 && Array.isArray(candidate.systems) && Array.isArray(candidate.details)
            && candidate.controls && typeof candidate.controls === "object"
            && candidate.classId === classId && candidate.fingerprint === fingerprint
            && candidate.route === window.location.pathname + window.location.search) {
            saved = candidate;
            window.sessionStorage.removeItem(storageKey);
        }
    } catch { /* Reading state is optional when session storage is unavailable. */ }
    const applied = new WeakSet();
    let scrolled = false;
    const systems = () => [...root.querySelectorAll(".native-class-customization-system")];
    const controlKey = control => {
        const system = control.closest(".native-class-customization-system");
        return `${system ? systems().indexOf(system) : -1}:${control.getAttribute("aria-label")}`;
    };
    const restore = () => {
        if (!saved) return;
        const panels = systems();
        panels.forEach((panel, index) => {
            if (applied.has(panel)) return;
            applied.add(panel);
            panel.open = saved.systems?.includes(index) ?? false;
        });
        for (const control of root.querySelectorAll("input[aria-label],select[aria-label]")) {
            if (applied.has(control)) continue;
            const state = saved.controls?.[controlKey(control)];
            if (!state) continue;
            applied.add(control);
            if (control.type === "checkbox") control.checked = Boolean(state.checked);
            else control.value = state.value;
            control.dispatchEvent(new Event(control.type === "search" ? "input" : "change", { bubbles: true }));
        }
        for (const detail of root.querySelectorAll("details[id],.native-class-customization-option-detail")) {
            if (applied.has(detail)) continue;
            applied.add(detail);
            const key = detail.id || detail.closest("[data-option-id]")?.getAttribute("data-option-id");
            detail.open = saved.details?.includes(key) ?? false;
        }
        const waiting = saved.systems?.some(index => panels[index]
            && panels[index].getAttribute("data-options-ready") !== "true");
        if (!waiting && !scrolled) {
            scrolled = true;
            const applyScroll = () => {
                const pane = root.closest(".rules-core-library-detail");
                if (pane) pane.scrollTop = saved.scrollTop || 0;
                if (document.scrollingElement) document.scrollingElement.scrollTop = saved.pageScrollTop || 0;
            };
            if (typeof requestAnimationFrame === "function") requestAnimationFrame(applyScroll);
            else queueMicrotask(applyScroll);
        }
    };
    root.addEventListener("click", event => {
        if ((event.button ?? 0) !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const link = event.target?.closest?.("a[href]");
        const href = link?.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        try {
            // A user can follow another rule before deferred catalogs finish
            // restoring. Retain the prior values for controls/options that have
            // not been restored yet, instead of replacing them with defaults.
            const controls = { ...(saved?.controls ?? {}) };
            for (const control of root.querySelectorAll("input[aria-label],select[aria-label]")) {
                if (!saved || applied.has(control)) controls[controlKey(control)] = {
                    value: control.value, checked: control.checked
                };
            }
            const details = new Set(saved?.details ?? []);
            for (const detail of root.querySelectorAll("details[id],.native-class-customization-option-detail")) {
                if (saved && !applied.has(detail)) continue;
                const key = detail.id || detail.closest("[data-option-id]")?.getAttribute("data-option-id");
                if (detail.open) details.add(key);
                else details.delete(key);
            }
            window.sessionStorage.setItem(storageKey, JSON.stringify({
                version: 1, classId, fingerprint, route: window.location.pathname + window.location.search,
                className: root.querySelector("h2")?.textContent,
                fragment: window.location.hash.startsWith("#native-class-") ? window.location.hash : "",
                systems: systems().flatMap((panel, index) =>
                    (saved && !applied.has(panel) ? saved.systems.includes(index) : panel.open) ? [index] : []),
                controls, details: [...details],
                scrollTop: root.closest(".rules-core-library-detail")?.scrollTop || 0,
                pageScrollTop: document.scrollingElement?.scrollTop || 0
            }));
        } catch { /* Browsing remains usable without persistent reading state. */ }
    }, true);
    return { restore, restored: Boolean(saved) };
}

export function classReturnLink(classId, fingerprint) {
    try {
        const saved = JSON.parse(window.sessionStorage.getItem("rulesWikiClassReturn"));
        if (saved?.version !== 1 || saved.classId !== classId || saved.fingerprint !== fingerprint
            || typeof saved.route !== "string") return null;
        const url = new URL(saved.route, window.location.origin);
        if (url.origin !== window.location.origin || !url.pathname.endsWith(`/rules/${encodeURIComponent(classId)}`)) return null;
        const fragment = typeof saved.fragment === "string" && /^#native-class-[\w.%~-]+$/.test(saved.fragment) ? saved.fragment : "";
        return { href: url.pathname + url.search + fragment, label: `Back to ${saved.className || "class"}` };
    } catch { return null; }
}
