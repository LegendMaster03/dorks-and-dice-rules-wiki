/**
 * Maps hosted-tool paths and URL query parameters to browser state so
 * back/forward and shared links restore the same search and selection.
 */
import {
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "./rules-browser-config.js";
import { DEFAULT_RULESET_ID, parseQualifiedRoute, catalogRoute, categoryRoute, ruleRoute } from "./rules-context.js";
import { normalizeBrowserFieldFilters } from "./rules-browser-filters.js";

/** Unknown or unsupported paths intentionally yield no selection. */
export function parseToolRoute(toolRoute) {
    if (!toolRoute || toolRoute === "/") return {};
    const path = String(toolRoute).split(/[?#]/, 1)[0];
    const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (segments.length === 1 && segments[0] === "all") return { entityType: "" };
    const qualified = parseQualifiedRoute(path);
    if (qualified) {
        if (qualified.status !== "valid") return { unsupportedRulesContext: true };
        return { rulesetId: qualified.rulesetId, qualified: true,
            ...(qualified.kind === "rule" ? { conceptKey: qualified.ruleId } : {}),
            ...(qualified.kind === "category" ? { entityType: qualified.category } : {}) };
    }
    const known = getEntityBrowserConfigForRoute(segments[0]);
    if (segments.length === 1 && known) {
        return { entityType: known.entityType };
    }
    if (segments.length === 2 && known) {
        return {
            entityType: known.entityType,
            conceptKey: `${known.entityType}.${decodeURIComponent(segments[1])}`
        };
    }
    if (segments.length === 2 && segments[0] === "types") {
        return { entityType: decodeURIComponent(segments[1]) };
    }
    if (segments.length === 2 && segments[0] === "rules") {
        return { conceptKey: decodeURIComponent(segments[1]) };
    }
    if (segments.length === 2 && segments[0] === "references") {
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

/** Normalize URL-backed query, sorting, and field filters. */
export function parseBrowserViewState(search = "", entityType = "") {
    const parameters = new URLSearchParams(search);
    const query = (parameters.get("q") ?? "").trim();
    const sortKey = (parameters.get("sort") ?? "").trim() || null;
    const requestedDirection = (parameters.get("dir") ?? "").toLowerCase();
    const sortDirection = requestedDirection === "desc" ? "desc" : "asc";
    const sourceCode = (parameters.get("source") ?? "").trim();
    const overridesOnly = parameters.get("overrides") === "1";
    const fieldFilters = {};
    for (const [key, value] of parameters.entries()) {
        if (!key.startsWith("f.")) continue;
        const filterKey = key.slice(2).trim();
        const filterValue = value.trim();
        if (filterKey && filterValue) fieldFilters[filterKey] = filterValue;
    }
    return {
        query,
        sortKey,
        sortDirection,
        sourceCode,
        overridesOnly,
        fieldFilters: normalizeBrowserFieldFilters(entityType, fieldFilters)
    };
}

export function parseBrowserViewStateFromLocation(entityType = "") {
    return parseBrowserViewState(window.location.search, entityType);
}

/** Preserve active browser filters when constructing a destination URL. */
export function browserHref(app, toolRelativePath, scopeValue = app.browserScope) {
    const base = app.hostContext.toolBasePath ?? "/tools/rules-wiki";
    const activeRoute = parseToolRoute(currentToolRoute(app));
    let relative = toolRelativePath || "/";
    const id = app.rulesContext?.rulesetId;
    if (id && (activeRoute.qualified || id !== DEFAULT_RULESET_ID) && !parseQualifiedRoute(relative)) {
        const legacy = parseToolRoute(relative);
        if (legacy.conceptKey) relative = ruleRoute(id, legacy.conceptKey);
        else if (legacy.entityType) relative = categoryRoute(id, legacy.entityType);
        else if (relative === "/" || relative === "/all") relative = catalogRoute(id);
    }
    const path = `${base.replace(/\/$/, "")}${relative}`;
    const parameters = new URLSearchParams(window.location.search);
    parameters.delete("browse");
    if (id && relative === catalogRoute(id)) parameters.set("browse", "1");
    parameters.delete("scope");
    parameters.delete("q");
    parameters.delete("sort");
    parameters.delete("dir");
    parameters.delete("source");
    parameters.delete("overrides");
    for (const key of [...parameters.keys()]) {
        if (key.startsWith("f.")) parameters.delete(key);
    }

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

    const sourceCode = String(app.browserFilters?.sourceCode ?? "").trim();
    if (sourceCode) parameters.set("source", sourceCode);
    if (scopeValue?.startsWith("campaign:") && app.browserFilters?.overridesOnly) {
        parameters.set("overrides", "1");
    }

    const entityType = app.browserFilters?.entityType ?? "";
    const fieldFilters = normalizeBrowserFieldFilters(
        entityType,
        app.browserFilters?.fieldFilters ?? {});
    for (const key of Object.keys(fieldFilters).sort()) {
        parameters.set(`f.${key}`, fieldFilters[key]);
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

export function catalogRouteForEntity(entityType, app = null) {
    const id = app?.rulesContext?.rulesetId;
    if (id && (id !== DEFAULT_RULESET_ID || parseToolRoute(currentToolRoute(app)).qualified))
        return entityType ? categoryRoute(id, entityType) : catalogRoute(id);
    if (!entityType) return "/all";
    const configuration = getEntityBrowserConfig(entityType);
    if (configuration.routeFamily) return `/${configuration.routeFamily}`;
    return `/types/${encodeURIComponent(entityType)}`;
}
