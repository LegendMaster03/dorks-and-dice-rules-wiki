import { installWorkspaceRouting, RULES_LAWYER_TOOL_ROUTE } from "../src/RulesWiki.Web/wwwroot/workspace-routing.js";
import {
    catalogRouteForEntity,
    parseBrowserViewState,
    replaceToolRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";
import {
    canSortBrowserDataset,
    normalizeBrowserSort,
    sortRulesForBrowser
} from "../src/RulesWiki.Web/wwwroot/rules-browser-index.js";
import { isCompactRulesBrowserWidth } from "../src/RulesWiki.Web/wwwroot/rules-browser.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createWindow(pathname) {
    const listeners = [];
    const setHref = href => {
        const parsed = new URL(href, "https://rules.test");
        globalThis.window.location.pathname = parsed.pathname;
        globalThis.window.location.search = parsed.search;
    };
    return {
        innerWidth: 1440,
        location: { pathname, search: "" },
        history: {
            pushState(_state, _title, href) { setHref(href); },
            replaceState(_state, _title, href) { setHref(href); }
        },
        addEventListener(type, listener, options) {
            if (type === "popstate") listeners.push({ listener, options });
        },
        async dispatchPopState() {
            let stopped = false;
            const event = { stopImmediatePropagation() { stopped = true; } };
            for (const entry of listeners) {
                await entry.listener(event);
                if (stopped) break;
            }
            return stopped;
        }
    };
}

function createApp({ route, canEditGlobal }) {
    let renders = 0;
    return {
        hostContext: {
            toolBasePath: "/tools/rules-wiki",
            toolRoute: route
        },
        canEditGlobal,
        activeView: "library",
        libraryDeepLink: null,
        libraryRouteActive: false,
        browserDeepLink: null,
        browserSelectedConceptKey: null,
        viewNavigation: {},
        renderActiveView: async () => {},
        render: async () => { renders += 1; },
        get renderCount() { return renders; }
    };
}

globalThis.window = createWindow("/tools/rules-wiki/adjudication/rules-lawyer");
let app = createApp({ route: RULES_LAWYER_TOOL_ROUTE, canEditGlobal: true });
installWorkspaceRouting(app);
assert(app.activeView === "global", "direct Rules Lawyer route must select the global workspace");

window.location.pathname = "/tools/rules-wiki/monsters";
await app.viewNavigation.global();
assert(window.location.pathname === "/tools/rules-wiki/adjudication/rules-lawyer",
    "menu navigation must push the addressable Rules Lawyer route");
assert(app.activeView === "global", "menu navigation must render Rules Lawyer");
assert(app.renderCount === 1, "menu navigation must render exactly once");

window.location.pathname = "/tools/rules-wiki/monsters";
let stopped = await window.dispatchPopState();
assert(!stopped, "non-workspace popstate must remain available to catalog routing");

window.location.pathname = "/tools/rules-wiki/adjudication/rules-lawyer";
stopped = await window.dispatchPopState();
assert(stopped, "Rules Lawyer popstate must claim its route before catalog routing");
assert(app.activeView === "global", "back/forward navigation must restore Rules Lawyer");
assert(app.renderCount === 2, "Rules Lawyer popstate must rerender the workspace");

globalThis.window = createWindow("/tools/rules-wiki/adjudication/rules-lawyer");
app = createApp({ route: RULES_LAWYER_TOOL_ROUTE, canEditGlobal: false });
installWorkspaceRouting(app);
assert(app.activeView === "rules-lawyer-access-denied",
    "direct routing must not bypass Rules Lawyer authority");

const restored = parseBrowserViewState("?q=fire+ball&sort=level&dir=desc");
assert(restored.query === "fire ball", "browser search must restore from route state");
assert(restored.sortKey === "level", "browser sort field must restore from route state");
assert(restored.sortDirection === "desc", "browser sort direction must restore from route state");

const browserApp = {
    hostContext: { toolBasePath: "/tools/rules-wiki" },
    browserScope: "campaign:campaign-1",
    browserFilters: { query: "fire ball" },
    browserSort: { key: "level", direction: "desc" }
};
globalThis.window = createWindow("/tools/rules-wiki/spells");
window.location.search = "?unrelated=kept";
replaceToolRoute(browserApp, catalogRouteForEntity("spell"), browserApp.browserScope);
const routed = new URLSearchParams(window.location.search);
assert(routed.get("scope") === "campaign:campaign-1", "campaign scope must remain in browser route state");
assert(routed.get("q") === "fire ball", "search must remain in browser route state");
assert(routed.get("sort") === "level" && routed.get("dir") === "desc",
    "sort must remain in browser route state");
assert(routed.get("unrelated") === "kept", "unrelated host query state must be preserved");

const monsters = [
    {
        conceptKey: "monster.young-dragon",
        displayName: "Young Dragon",
        browserFields: [{ key: "cr", value: "2" }]
    },
    {
        conceptKey: "monster.wolf",
        displayName: "Wolf",
        browserFields: [{ key: "cr", value: "1/4" }]
    },
    {
        conceptKey: "monster.scout",
        displayName: "Scout",
        browserFields: [{ key: "cr", value: "1/2" }]
    }
];
assert(!canSortBrowserDataset(2, 3), "partial incremental catalogs must not enable client sorting");
assert(canSortBrowserDataset(3, 3), "complete bounded catalogs may enable client sorting");
const sorted = sortRulesForBrowser(monsters, "monster", { key: "cr", direction: "asc" });
assert(sorted.map(value => value.conceptKey).join(",")
    === "monster.wolf,monster.scout,monster.young-dragon",
"CR sorting must compare fractions numerically and remain deterministic");
const normalized = normalizeBrowserSort("spell", { key: "not-a-column", direction: "desc" });
assert(normalized.key === null && normalized.direction === "asc",
    "family changes must discard invalid sort columns");

assert(isCompactRulesBrowserWidth(900), "900px hosted width must use list/detail drill-in");
assert(!isCompactRulesBrowserWidth(901), "wide hosted width must retain parallel list/detail panes");
