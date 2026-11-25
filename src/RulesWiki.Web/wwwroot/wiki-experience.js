/**
 * Wiki landing page, recently read references, and resizable index/detail
 * workspace. Reading history is presentation state, not ruleset state.
 */
import { element as el, clear } from "./ui.js";
import { currentToolRoute, parseToolRoute, parseBrowserViewStateFromLocation } from "./rules-browser-routing.js";
import { DEFAULT_RULESET_ID, catalogRoute, ruleRoute, referenceKey, snapshotKey } from "./rules-context.js";
import { authorizedRulesetDescriptors } from "./rules-reference-api.js";
import { cancelNativeDetailRender } from "./rules-browser-detail.js";
import { getEntityBrowserConfig } from "./rules-browser-config.js";
import { renderPackageAttribution, packageDisplayName } from "./package-attribution.js";

export const WIKI_GROUPS = [
    { name: "Characters", description: "Classes, choices, skills, and competencies", types: [
        ["class", "Classes"], ["subclass", "Subclasses"], ["prestigeClass", "Prestige Classes"],
        ["species", "Species"], ["subspecies", "Subspecies"], ["race", "Races"], ["subrace", "Subraces"],
        ["background", "Backgrounds"], ["feat", "Feats"], ["skill", "Skills"], ["competency", "Competencies"],
        ["classFeature", "Class Features"], ["optionalfeature", "Class Options"], ["patron", "Patrons"], ["pact", "Pacts"], ["invocation", "Invocations"] ] },
    { name: "Magic", description: "Spells and magical procedures", types: [["spell", "Spells"]] },
    { name: "Equipment", description: "Weapons, armor, gear, and magic items", types: [["item", "Items"]] },
    { name: "Rules", description: "Core procedures and conditions", types: [["rule", "Rules Reference"], ["condition", "Conditions"], ["skill-family", "Skill Families"]] },
    { name: "Creatures", description: "Stat blocks, types, and families", types: [["monster", "Bestiary"], ["creatureType", "Creature Types"], ["creature-type", "Creature Types"], ["monster-family", "Creature Families"], ["monsterFamily", "Creature Families"]] }
];

const readStored = (key, fallback) => { try { return JSON.parse(window.localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional device preferences. */ } };
export const recentRules = () => {
    const entries = readStored("rulesWikiRecent", []);
    return Array.isArray(entries) ? entries.filter(e => e && typeof e.id === "string" && typeof e.name === "string").slice(0, 8) : [];
};
/** Record recently viewed native references for the Wiki landing page. */
export function rememberRule(rule) {
    save("rulesWikiRecent", [{ id: rule.id, name: rule.name, kind: rule.kind }, ...recentRules().filter(e => e.id !== rule.id)].slice(0, 8));
}

export function installWikiExperience(app) {
    app.root.classList.add("wiki-experience");
    const style = el("link", { attributes: { rel: "stylesheet", href: new URL("./wiki-experience.css", import.meta.url).href } });
    document.head.append(style);
    const fitHost = () => app.root.style.setProperty("--wiki-host-offset",
        `${Math.max(0, app.root.getBoundingClientRect().top + window.scrollY)}px`);
    fitHost();
    const resetPageScroll = () => document.scrollingElement?.scrollTo?.({ top: 0 });
    const routeIsHome = () => {
        const route = parseToolRoute(currentToolRoute(app));
        const params = new URLSearchParams(window.location.search);
        return (currentToolRoute(app) === "/" || (route.qualified && !route.entityType && !route.conceptKey))
            && !params.get("q") && params.get("browse") !== "1";
    };
    const resetSelection = (route, view = {}) => {
        app.browserScope = "global";
        app.browserFilters = { ...app.browserFilters, entityType: route.entityType ?? "",
            query: view.query ?? "", fieldFilters: view.fieldFilters ?? {},
            sourceCode: view.sourceCode ?? "", overridesOnly: false };
        app.browserSort = { key: view.sortKey ?? null, direction: view.sortDirection ?? "asc" };
        app.browserDeepLink = route.conceptKey ?? null;
        app.browserSelectedConceptKey = route.conceptKey ?? null;
        app.libraryDeepLink = null;
        app.libraryRouteActive = false;
    };
    const go = async (path, query = "", selected = app.rulesContext?.rulesetId) => {
        resetPageScroll();
        const base = (app.hostContext.toolBasePath ?? "/tools/rules-wiki").replace(/\/$/, "");
        const qualified = selected && (selected !== DEFAULT_RULESET_ID ||
            parseToolRoute(currentToolRoute(app)).qualified || selected !== app.rulesContext?.rulesetId);
        const destination = qualified ? catalogRoute(selected) : path;
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (qualified && path === "/all") params.set("browse", "1");
        window.history.pushState({}, "", base + destination + (params.size ? "?" + params : ""));
        resetSelection(parseToolRoute(destination), { query });
        app.activeView = "library";
        await app.render();
    };
    app.navigateWikiHome = () => go("/");
    const navigate = app.navigateRuleFamily.bind(app);
    app.navigateRuleFamily = async type => {
        resetPageScroll();
        app.browserFilters.query = "";
        await navigate(type);
    };
    let generation = 0;
    let bindingRoute = null;
    const clearContext = () => {
        cancelNativeDetailRender(app);
        app.rulesContext = null;
        app.rulesetReader = null;
        app.wikiIndex = null;
        app.wikiKinds = new Set();
        app.wikiPlaytests = [];
        app.wikiPlaytestsPartial = false;
        app.wikiUpdateAvailable = false;
        app.wikiUpdateDismissed = false;
        app.wikiPendingFingerprint = null;
    };
    const ensureContext = async serial => {
        const path = currentToolRoute(app);
        const route = parseToolRoute(path);
        const scope = new URLSearchParams(window.location.search).get("scope");
        const id = route.rulesetId ?? DEFAULT_RULESET_ID;
        const unavailable = route.unsupportedRulesContext || (scope && scope !== "global");
        if (!unavailable && app.rulesContext?.rulesetId === id && app.rulesetReader && app.wikiIndex) return true;
        clearContext();
        bindingRoute = path;
        resetSelection(route, parseBrowserViewStateFromLocation(route.entityType ?? ""));
        app.catalogError = null;
        const acceptInventory = response => {
            if (serial === generation) app.wikiDescriptors = authorizedRulesetDescriptors(response);
        };
        try {
            if (unavailable) {
                acceptInventory(await app.api.getNativeRulesets());
                throw Error("This ruleset or campaign scope is unavailable.");
            }
            const reader = await app.api.openRulesetReader(id, acceptInventory);
            if (serial !== generation) return false;
            if (reader.context.rulesetId !== id) throw Error("Ruleset identity did not match the requested context.");
            const index = await app.api.getGlobalRulesCatalog({ limit: 1, offset: 0 }, reader);
            if (serial !== generation) return false;
            app.rulesContext = reader.context;
            app.rulesetReader = reader;
            app.wikiIndex = index;
            app.wikiKinds = new Set(index.entityTypeFacets.map(f => f.entityType));
            return true;
        } catch (error) {
            if (serial !== generation) return false;
            app.catalogError = error;
            return false;
        } finally {
            if (serial === generation) bindingRoute = null;
        }
    };
    app.prepareWikiExperience = async () => { await ensureContext(++generation); };
    const renderApp = app.render.bind(app);
    app.render = async (...args) => {
        const serial = ++generation;
        const route = parseToolRoute(currentToolRoute(app));
        const scope = new URLSearchParams(window.location.search).get("scope");
        const switching = route.unsupportedRulesContext || (scope && scope !== "global")
            || app.rulesContext?.rulesetId !== (route.rulesetId ?? DEFAULT_RULESET_ID);
        if (switching) app.root.replaceChildren(el("p", { text: "Loading ruleset…" }));
        await ensureContext(serial);
        if (serial === generation) await renderApp(...args);
    };

    // Persist only stable qualified identities in this tab. Legacy history
    // contributes first-party IDs only; names are resolved in the bound snapshot.
    const historyKey = "rulesWikiRecentQualified";
    const readHistory = () => {
        try {
            const stored = JSON.parse(window.sessionStorage.getItem(historyKey));
            if (Array.isArray(stored)) return stored;
        } catch { /* Optional tab storage. */ }
        return recentRules().map(rule => ({ rulesetId: DEFAULT_RULESET_ID, id: rule.id }));
    };
    let history = readHistory().filter(entry => {
        try { referenceKey(entry.rulesetId, entry.id); return true; } catch { return false; }
    });
    const saveHistory = () => {
        try { window.sessionStorage.setItem(historyKey, JSON.stringify(history)); } catch { /* Optional tab storage. */ }
    };
    const recentNames = new Map();
    app.rememberNativeReference = (context, rule) => {
        if (app.rulesContext !== context && (app.rulesContext?.rulesetId !== context.rulesetId ||
            app.rulesContext?.fingerprint !== context.fingerprint)) return;
        const key = referenceKey(context.rulesetId, rule.id);
        history = [{ rulesetId: context.rulesetId, id: rule.id }, ...history.filter(entry =>
            referenceKey(entry.rulesetId, entry.id) !== key)].slice(0, 64);
        recentNames.set(snapshotKey(context, rule.id), rule.name);
        saveHistory();
    };
    const loadRecents = async reader => {
        const context = reader.context;
        const entries = history.filter(entry => entry.rulesetId === context.rulesetId).slice(0, 8);
        return (await Promise.all(entries.map(async entry => {
            const key = snapshotKey(context, entry.id);
            try {
                if (!recentNames.has(key)) recentNames.set(key, (await reader.resolve(entry.id)).rule.name);
                return { id: entry.id, name: recentNames.get(key) };
            } catch { return null; }
        }))).filter(Boolean);
    };
    const playtestCache = new WeakMap();
    const loadPlaytests = async reader => {
        if (reader.context.rulesetId !== DEFAULT_RULESET_ID || !app.wikiKinds.has("class")) return { rules: [], partial: false };
        if (!playtestCache.has(reader)) playtestCache.set(reader, (async () => {
            const page = await app.api.getGlobalRulesCatalog({ entityType: "class", limit: 10 }, reader);
            const rules = (await Promise.all(page.rules.map(async row => {
                try {
                    const response = await reader.resolve(row.nativeId);
                    const d = response.rule.definition.definition ?? response.rule.definition;
                    return d.alphaVersion ? { id: row.nativeId, name: row.displayName, version: d.alphaVersion } : null;
                } catch { return null; }
            }))).filter(Boolean);
            return { rules, partial: page.totalCount > page.rules.length };
        })().catch(() => ({ rules: [], partial: false })));
        return playtestCache.get(reader);
    };
    // Current native projections lack contextual row fields. Do not resolve
    // every visible row or infer owners from identifiers. Core projection is
    // tracked in the workstream integration requirements.
    app.decorateBrowserRows = null;
    const availableGroups = () => {
        const groups = WIKI_GROUPS.map(group => ({ ...group,
            types: group.types.filter(([type]) => app.wikiKinds?.has(type)) })).filter(group => group.types.length);
        const configured = new Set(groups.flatMap(group => group.types.map(([type]) => type)));
        const extra = [...(app.wikiKinds ?? [])].filter(type => !configured.has(type))
            .sort().map(type => [type, getEntityBrowserConfig(type).label]);
        if (extra.length) groups.push({ name: "Other categories", description: "Additional native reference categories", types: extra });
        return groups;
    };
    app.renderNavigation = () => {
        const nav = el("nav", { className: "wiki-ribbon", ariaLabel: "Rules Wiki" });
        const selector = el("select", { className: "form-select form-select-sm wiki-ruleset-selector", ariaLabel: "Ruleset" });
        selector.append(el("option", { value: "", text: "Select ruleset", disabled: true }));
        for (const descriptor of app.wikiDescriptors ?? [])
            selector.append(el("option", { value: descriptor.id,
                text: descriptor.metadata?.displayName ?? descriptor.id }));
        selector.value = app.rulesContext?.rulesetId ?? "";
        selector.addEventListener("change", () => { if (selector.value) void go("/", "", selector.value); });
        nav.append(selector, el("button", { type: "button", text: "Wiki home", disabled: !app.rulesContext, onClick: app.navigateWikiHome }));
        const groups = el("div", { className: "wiki-ribbon-groups" });
        for (const group of availableGroups()) {
            const menu = el("details", { className: "wiki-ribbon-menu" }, el("summary", { text: group.name }));
            const items = el("div", { className: "wiki-ribbon-items" });
            for (const [type, title] of group.types) items.append(el("button", { type: "button", text: title,
                attributes: { ...(app.browserFilters.entityType === type ? { "aria-current": "page" } : {}) },
                onClick: () => app.navigateRuleFamily(type) }));
            menu.append(items);
            menu.addEventListener("toggle", () => { if (menu.open) for (const other of groups.children) if (other !== menu) other.open = false; });
            groups.append(menu);
        }
        const browse = el("details", { className: "wiki-mobile-menu" }, el("summary", { text: "Browse sections" }), groups);
        browse.open = window.innerWidth > 560;
        nav.append(browse, el("button", { type: "button", text: "Search all rules", disabled: !app.rulesContext, onClick: () => go("/all") }));
        return nav;
    };
    const render = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        fitHost();
        container.classList.add("rules-core-main");
        if (!app.rulesContext || !app.rulesetReader || app.catalogError) {
            container.dataset.rulesView = "unavailable";
            container.replaceChildren(el("section", { className: "card card-body" },
                el("h2", { text: "Ruleset unavailable" }),
                el("p", { text: "This ruleset or scope is unavailable in the authorized native catalog. Select an available ruleset or retry." }),
                el("button", { type: "button", text: "Retry", onClick: () => app.render() })));
            return;
        }
        const reader = app.rulesetReader;
        if (routeIsHome()) {
            container.dataset.rulesView = "home";
            const [recent, playtests] = await Promise.all([loadRecents(reader), loadPlaytests(reader)]);
            if (!container.isConnected || reader !== app.rulesetReader) return;
            app.wikiPlaytests = playtests.rules;
            app.wikiPlaytestsPartial = playtests.partial;
            renderHome(container, recent);
        } else {
            await render(container);
            if (!container.isConnected || reader !== app.rulesetReader) return;
            const workspace = container.querySelector(".rules-core-library-workspace");
            if (workspace) installPaneDivider(workspace);
        }
        if (app.wikiUpdateAvailable && !app.wikiUpdateDismissed) container.prepend(updateNotice());
    };
    const updateNotice = () => el("aside", { className: "wiki-update-notice", attributes: { role: "status" } },
        el("span", { text: "Updated rules are available. Refresh when you are ready." }),
        el("button", { type: "button", text: "Refresh rules", onClick: () => window.location.reload() }),
        el("button", { type: "button", text: "Dismiss", onClick: () => {
            app.wikiUpdateDismissed = true; app.root.querySelector(".wiki-update-notice")?.remove();
        } }));
    let checking = false;
    const checkUpdates = async () => {
        if (checking || bindingRoute || document.visibilityState === "hidden" || !app.rulesContext) return;
        checking = true;
        const reader = app.rulesetReader;
        try {
            const sets = await app.api.getNativeRulesets();
            if (reader !== app.rulesetReader) return;
            app.wikiDescriptors = authorizedRulesetDescriptors(sets);
            const current = app.wikiDescriptors.find(r => r.id === reader.context.rulesetId);
            if (!current) {
                clearContext();
                await app.render();
                return;
            }
            if (current.fingerprint !== reader.context.fingerprint) {
                if (app.wikiPendingFingerprint !== current.fingerprint) app.wikiUpdateDismissed = false;
                app.wikiPendingFingerprint = current.fingerprint;
                app.wikiUpdateAvailable = true;
                if (!app.wikiUpdateDismissed && !app.root.querySelector(".wiki-update-notice")) app.root.prepend(updateNotice());
            }
        } catch { /* Update discovery does not interrupt an open rule. */ }
        finally { checking = false; }
    };
    window.addEventListener("focus", checkUpdates);
    document.addEventListener("visibilitychange", checkUpdates);
    let compactMenu = window.innerWidth <= 560;
    window.addEventListener("resize", () => {
        fitHost();
        const compact = window.innerWidth <= 560;
        if (compact === compactMenu) return;
        compactMenu = compact;
        const menu = app.root.querySelector(".wiki-mobile-menu");
        if (menu) menu.open = !compact;
    });

    function renderHome(container, recent) {
        clear(container);
        const home = el("section", { className: "wiki-home" },
            el("header", {}, el("p", { className: "wiki-eyebrow", text: packageDisplayName(app.rulesContext, app.rulesetReader.packageDescriptor) }),
                el("h1", { text: "Rules Wiki" }), el("p", { text: "Find a rule. Explore a class. Return to your game." })));
        const search = el("input", { type: "search", placeholder: "Search all rules…", ariaLabel: "Search all rules", attributes: { autocomplete: "off" } });
        const form = el("form", { className: "wiki-home-search" }, search, el("button", { type: "submit", text: "Search" }));
        form.addEventListener("submit", event => { event.preventDefault(); go("/all", search.value.trim()); });
        home.append(form, el("h2", { text: "Browse the reference" }));
        const grid = el("div", { className: "wiki-home-grid" });
        for (const group of availableGroups()) {
            const card = el("section", { className: "wiki-home-category" }, el("h3", { text: group.name }), el("p", { text: group.description }));
            const links = el("div", { className: "wiki-home-links" });
            for (const [type, title] of group.types) links.append(el("button", { type: "button", text: title, onClick: () => app.navigateRuleFamily(type) }));
            card.append(links); grid.append(card);
        }
        home.append(grid);
        if (recent.length) {
            const section = el("section", { className: "wiki-recent" }, el("h2", { text: "Recently viewed" }));
            const list = el("ul");
            for (const rule of recent) list.append(el("li", {}, el("a", { text: rule.name,
                attributes: { href: app.hostContext.toolBasePath.replace(/\/$/, "") + ruleRoute(app.rulesContext.rulesetId, rule.id) } })));
            section.append(list, el("button", { type: "button", text: "Clear recently viewed", onClick: () => {
                history = history.filter(entry => entry.rulesetId !== app.rulesContext.rulesetId);
                saveHistory();
                section.remove();
            } }));
            home.append(section);
        }
        if (app.wikiPlaytests?.length || app.wikiPlaytestsPartial) home.append(el("aside", { className: "wiki-playtest-notes" },
            el("h2", { text: "Playtest information" }), el("p", { text: app.wikiPlaytestsPartial
                ? "Playtest information is shown for the first ten classes. Open a class for its current rules."
                : "These published classes are in active testing. Open a class for its current rules." }),
            ...app.wikiPlaytests.map(rule => el("a", { text: `${rule.name} · Alpha ${rule.version}`,
                attributes: { href: app.hostContext.toolBasePath.replace(/\/$/, "") + ruleRoute(app.rulesContext.rulesetId, rule.id) } }))));
        if (app.wikiIndex?.rulesetId && app.wikiIndex?.fingerprint)
            home.append(renderPackageAttribution(app.wikiIndex, app.wikiIndex.packageDescriptor));
        container.append(home);
    }
}

/** Add a draggable divider for the reference browser's two panes. */
export function installPaneDivider(workspace) {
    if (workspace.querySelector(".wiki-pane-divider")) return;
    let ratio = Number(readStored("rulesWikiPaneRatio", .32));
    if (!Number.isFinite(ratio)) ratio = .32;
    const divider = el("div", { className: "wiki-pane-divider", attributes: {
        role: "separator", tabindex: "0", "aria-label": "Resize rules list", "aria-orientation": "vertical",
        "aria-valuemin": "22", "aria-valuemax": "55"
    } });
    const setRatio = value => {
        const width = workspace.getBoundingClientRect().width;
        const min = width > 0 ? Math.max(.22, 240 / width) : .22;
        const max = width > 0 ? Math.min(.55, 1 - 370 / width) : .55;
        ratio = Math.max(Math.min(min, max), Math.min(max, value));
        workspace.style.setProperty("--wiki-list-width", `${ratio * 100}%`);
        divider.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
        divider.setAttribute("aria-valuetext", `Rules list ${Math.round(ratio * 100)} percent`);
    };
    const persist = () => save("rulesWikiPaneRatio", ratio);
    divider.addEventListener("keydown", event => {
        const change = { ArrowLeft: -.02, ArrowRight: .02, Home: -.99, End: .99 }[event.key];
        if (change === undefined) return;
        event.preventDefault(); event.stopPropagation(); setRatio(ratio + change); persist();
    });
    divider.addEventListener("dblclick", () => { setRatio(.32); persist(); });
    let dragging = false;
    divider.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        dragging = true; divider.setPointerCapture?.(event.pointerId); event.preventDefault();
    });
    divider.addEventListener("pointermove", event => {
        if (!dragging) return;
        const bounds = workspace.getBoundingClientRect();
        if (bounds.width) setRatio((event.clientX - bounds.left) / bounds.width);
    });
    const finish = () => { if (dragging) { dragging = false; persist(); } };
    divider.addEventListener("pointerup", finish);
    divider.addEventListener("pointercancel", finish);
    divider.addEventListener("lostpointercapture", finish);
    workspace.insertBefore(divider, workspace.querySelector(".rules-core-library-detail"));
    setRatio(ratio);
    // Bounds are recalculated for each drag; CSS owns the compact layout.
}
