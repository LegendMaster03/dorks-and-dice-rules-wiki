import { readingKey } from "./rules-context.js";

// Scroll the reader alone so section jumps do not move the Site ribbon.
export function scrollNativeClassTarget(target, inset = 120) {
    const pane = target.closest?.(".rules-core-library-detail");
    if (pane && target.getBoundingClientRect && pane.getBoundingClientRect) {
        pane.scrollTop = Math.max(0, pane.scrollTop
            + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - inset);
    } else target.scrollIntoView?.({ block: "start" });
}

// Fragment history inside a mounted native class must not reconstruct the
// browser pane. Ordinary rule routes still use the existing browser router.
export function restoreMountedClassFragment(app, state, route, hash) {
    if (route.unsupportedRulesContext || !state?.rulesWikiClassView || state.rulesWikiClassView !== app.browserSelectedConceptKey
        || route.conceptKey !== app.browserSelectedConceptKey) return false;
    const root = app.root?.querySelector?.(".native-class-reference");
    if (!root || typeof root.revealNativeClassFragment !== "function") return false;
    if (root.nativeClassReadingKey) {
        if (!app.rulesContext || state.rulesWikiClassSnapshot !== root.nativeClassReadingKey) return false;
        try {
            if (readingKey(app.rulesContext, app.browserSelectedConceptKey, "class") !== root.nativeClassReadingKey) return false;
        } catch { return false; }
    } else if (state.rulesWikiClassSnapshot) return false;
    if (hash && hash.startsWith("#native-class-")) {
        try { return root.revealNativeClassFragment(decodeURIComponent(hash.slice(1))); }
        catch { return false; }
    }
    if (hash) return false;
    scrollNativeClassTarget(root, 0);
    return true;
}
