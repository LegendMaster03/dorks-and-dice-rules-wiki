// Fragment history inside a mounted native class must not reconstruct the
// browser pane. Ordinary rule routes still use the existing browser router.
export function restoreMountedClassFragment(app, state, route, hash) {
    if (!state?.rulesWikiClassView || state.rulesWikiClassView !== app.browserSelectedConceptKey
        || route.conceptKey !== app.browserSelectedConceptKey) return false;
    const root = app.root?.querySelector?.(".native-class-reference");
    if (!root || typeof root.revealNativeClassFragment !== "function") return false;
    if (hash && hash.startsWith("#native-class-")) {
        try { return root.revealNativeClassFragment(decodeURIComponent(hash.slice(1))); }
        catch { return false; }
    }
    if (hash) return false;
    root.scrollIntoView?.({ block: "start" });
    return true;
}
