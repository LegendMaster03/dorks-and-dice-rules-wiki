const ROUTE_FAMILIES = new Map([
    ["monsters", "monster"],
    ["spells", "spell"],
    ["classes", "class"],
    ["subclasses", "subclass"],
    ["prestige-classes", "prestigeClass"],
    ["feats", "feat"],
    ["backgrounds", "background"],
    ["optional-features", "optionalfeature"],
    ["races", "race"],
    ["species", "species"],
    ["items", "item"],
    ["conditions", "condition"],
    ["skills", "skill"]
]);

export function parseToolRoute(toolRoute) {
    if (!toolRoute || toolRoute === "/") return {};
    const path = String(toolRoute).split(/[?#]/, 1)[0];
    const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (segments.length === 1 && ROUTE_FAMILIES.has(segments[0])) {
        return { entityType: ROUTE_FAMILIES.get(segments[0]) };
    }
    if (segments.length === 2 && ROUTE_FAMILIES.has(segments[0])) {
        const entityType = ROUTE_FAMILIES.get(segments[0]);
        return {
            entityType,
            conceptKey: `${entityType}.${decodeURIComponent(segments[1])}`
        };
    }
    if (segments.length === 2 && segments[0] === "types") {
        return { entityType: decodeURIComponent(segments[1]) };
    }
    if (segments.length === 2 && segments[0] === "rules") {
        return { conceptKey: decodeURIComponent(segments[1]) };
    }
    return {};
}

export function currentToolRoute(app) {
    const base = (app.hostContext.toolBasePath ?? "/tools/rules-wiki").replace(/\/$/, "");
    const path = window.location.pathname;
    return path.startsWith(base) ? path.slice(base.length) || "/" : "/";
}

export function parseBrowserScopeFromLocation(app) {
    const requested = new URLSearchParams(window.location.search).get("scope");
    if (!requested || requested === "global") return "global";
    if (!requested.startsWith("campaign:")) return null;

    const campaignId = requested.slice("campaign:".length);
    return app.campaigns.some(value => String(value.id) === campaignId)
        ? requested
        : null;
}

export function parseBrowserViewState(search = "") {
    const parameters = new URLSearchParams(search);
    const query = (parameters.get("q") ?? "").trim();
    const sortKey = (parameters.get("sort") ?? "").trim() || null;
    const requestedDirection = (parameters.get("dir") ?? "").toLowerCase();
    const sortDirection = requestedDirection === "desc" ? "desc" : "asc";
    return { query, sortKey, sortDirection };
}

export function parseBrowserViewStateFromLocation() {
    return parseBrowserViewState(window.location.search);
}

export function browserHref(app, toolRelativePath, scopeValue = app.browserScope) {
    const base = app.hostContext.toolBasePath ?? "/tools/rules-wiki";
    const path = `${base.replace(/\/$/, "")}${toolRelativePath || "/"}`;
    const parameters = new URLSearchParams(window.location.search);
    parameters.delete("scope");
    parameters.delete("q");
    parameters.delete("sort");
    parameters.delete("dir");

    if (scopeValue?.startsWith("campaign:")) {
        parameters.set("scope", scopeValue);
    }

    const query = String(app.browserFilters?.query ?? "").trim();
    if (query) parameters.set("q", query);

    const sortKey = app.browserSort?.key ?? null;
    if (sortKey) {
        parameters.set("sort", sortKey);
        if (app.browserSort?.direction === "desc") parameters.set("dir", "desc");
    }

    const queryString = parameters.toString();
    return queryString ? `${path}?${queryString}` : path;
}

export function pushToolRoute(app, toolRelativePath, scopeValue = app.browserScope) {
    updateToolRoute(app, toolRelativePath, scopeValue, false);
}

export function replaceToolRoute(app, toolRelativePath, scopeValue = app.browserScope) {
    updateToolRoute(app, toolRelativePath, scopeValue, true);
}

function updateToolRoute(app, toolRelativePath, scopeValue, replace) {
    const href = browserHref(app, toolRelativePath || "/", scopeValue);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === href) return;
    if (replace) {
        window.history.replaceState({}, "", href);
    } else {
        window.history.pushState({}, "", href);
    }
}

export function catalogRouteForEntity(entityType) {
    if (!entityType) return "/";
    for (const [segment, mappedType] of ROUTE_FAMILIES.entries()) {
        if (mappedType === entityType) return `/${segment}`;
    }
    return `/types/${encodeURIComponent(entityType)}`;
}
