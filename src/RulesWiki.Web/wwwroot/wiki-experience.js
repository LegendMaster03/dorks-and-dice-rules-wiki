import { element as el, clear } from "./ui.js";
import { currentToolRoute } from "./rules-browser-routing.js";

export const WIKI_GROUPS = [
    { name: "Characters", description: "Classes, choices, skills, and competencies", types: [
        ["class", "Classes"], ["subclass", "Subclasses"], ["prestigeClass", "Prestige Classes"],
        ["species", "Species"], ["subspecies", "Subspecies"], ["race", "Races"],
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
export function rememberRule(rule) {
    save("rulesWikiRecent", [{ id: rule.id, name: rule.name, kind: rule.kind }, ...recentRules().filter(e => e.id !== rule.id)].slice(0, 8));
}

export function installWikiExperience(app) {
    app.root.classList.add("wiki-experience");
    const style = el("link", { attributes: { rel: "stylesheet", href: new URL("./wiki-experience.css", import.meta.url).href } });
    document.head.append(style);
    const go = async (path, query = "") => {
        const base = (app.hostContext.toolBasePath ?? "/tools/rules-wiki").replace(/\/$/, "");
        window.history.pushState({}, "", `${base}${path}${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        app.browserFilters = { ...app.browserFilters, entityType: "", query, fieldFilters: {}, sourceCode: "", overridesOnly: false };
        app.browserDeepLink = null;
        app.browserSelectedConceptKey = null;
        app.activeView = "library";
        await app.render();
    };
    app.navigateWikiHome = () => go("/");
    const navigate = app.navigateRuleFamily.bind(app);
    app.navigateRuleFamily = async type => {
        app.browserFilters.query = "";
        await navigate(type);
    };
    app.prepareWikiExperience = async () => {
        const readCatalog = app.api.getGlobalRulesCatalog.bind(app.api);
        app.wikiIndex = await readCatalog({ limit: 100000 });
        app.wikiKinds = new Set(app.wikiIndex.entityTypeFacets.map(f => f.entityType));
        const searches = new Map();
        // Preserve native search semantics, including owner and prerequisite matches.
        // Reuse matching snapshot results while changing filters or pages.
        app.api.getGlobalRulesCatalog = async (filters = {}) => {
            const query = String(filters.query ?? "").trim();
            let catalog = app.wikiIndex;
            if (query) {
                if (!searches.has(query)) searches.set(query, readCatalog({ query, limit: 100000 }).then(result => {
                    if (result.fingerprint !== app.wikiIndex.fingerprint)
                        throw new Error("The published rules have changed. Refresh to search the current snapshot.");
                    return result;
                }).catch(error => { searches.delete(query); throw error; }));
                catalog = await searches.get(query);
            }
            const rows = catalog.rules.filter(row => !filters.entityType || row.entityType === filters.entityType);
            const offset = filters.offset ?? 0;
            return { ...catalog, rules: rows.slice(offset, offset + (filters.limit ?? 25)), totalCount: rows.length };
        };
        // Class summaries provide version labels without inventing a release date.
        app.wikiPlaytests = [];
        await Promise.all(app.wikiIndex.rules.filter(r => r.entityType === "class").map(async row => {
            try {
                const response = await app.api.getNativeRule("first-party-001", row.nativeId);
                const d = response.rule.definition.definition ?? response.rule.definition;
                if (d.alphaVersion) app.wikiPlaytests.push({ id: row.nativeId, name: row.displayName, version: d.alphaVersion });
            } catch { /* A class card must not prevent the reference from opening. */ }
        }));
    };
    const contexts = new Map();
    app.decorateBrowserRows = async list => {
        const rows = [...list.querySelectorAll(".rules-core-library-row")].filter(row =>
            app.wikiIndex?.rules.find(rule => rule.nativeId === row.dataset.conceptKey)?.entityType === "classFeature");
        for (let start = 0; start < rows.length; start += 4) await Promise.all(rows.slice(start, start + 4).map(async row => {
            const id = row.dataset.conceptKey;
            if (!contexts.has(id)) contexts.set(id, app.api.getNativeRule("first-party-001", id).then(response => {
                if (response.fingerprint !== app.wikiIndex.fingerprint) return null;
                const d = response.rule.definition;
                const ownerId = d.parentClass ?? d.definition?.parentClass;
                const owner = app.wikiIndex.rules.find(rule => rule.nativeId === ownerId)?.displayName;
                const level = d.classLevel ?? d.definition?.classLevel;
                return owner ? `${owner}${Number.isInteger(level) ? ` · Level ${level}` : ""}` : null;
            }).catch(() => { contexts.delete(id); return null; }));
            const context = await contexts.get(id);
            if (context && row.isConnected && !row.querySelector(".wiki-row-context")) row.querySelector(".rules-core-library-cell--name")?.append(
                el("span", { className: "wiki-row-context", text: context }));
        }));
    };
    const availableGroups = () => WIKI_GROUPS.map(group => ({ ...group,
        types: group.types.filter(([type]) => app.wikiKinds?.has(type)) })).filter(group => group.types.length);
    app.renderNavigation = () => {
        const nav = el("nav", { className: "wiki-ribbon", ariaLabel: "Rules Wiki" });
        nav.append(el("button", { type: "button", text: "Wiki home", onClick: app.navigateWikiHome }));
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
        nav.append(browse, el("button", { type: "button", text: "Search all rules", onClick: () => go("/all") }));
        return nav;
    };
    const render = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        container.classList.add("rules-core-main");
        const home = currentToolRoute(app) === "/" && !new URLSearchParams(window.location.search).get("q");
        if (home) { container.dataset.rulesView = "home"; renderHome(container); }
        else {
            await render(container);
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
        if (checking || document.visibilityState === "hidden") return;
        checking = true;
        try {
            const sets = await app.api.getNativeRulesets();
            const current = sets.rulesets.find(r => r.id === "first-party-001");
            if (current && current.fingerprint !== app.wikiIndex?.fingerprint) {
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
        const compact = window.innerWidth <= 560;
        if (compact === compactMenu) return;
        compactMenu = compact;
        const menu = app.root.querySelector(".wiki-mobile-menu");
        if (menu) menu.open = !compact;
    });

    function renderHome(container) {
        clear(container);
        const home = el("section", { className: "wiki-home" },
            el("header", {}, el("p", { className: "wiki-eyebrow", text: "Dorks & Dice" }),
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
        const recent = recentRules().filter(entry => app.wikiIndex.rules.some(row => row.nativeId === entry.id));
        if (recent.length) {
            const section = el("section", { className: "wiki-recent" }, el("h2", { text: "Recently viewed" }));
            const list = el("ul");
            for (const rule of recent) list.append(el("li", {}, el("a", { text: rule.name,
                attributes: { href: `${app.hostContext.toolBasePath}/rules/${encodeURIComponent(rule.id)}` } })));
            section.append(list, el("button", { type: "button", text: "Clear recently viewed", onClick: () => { save("rulesWikiRecent", []); section.remove(); } }));
            home.append(section);
        }
        if (app.wikiPlaytests?.length) home.append(el("aside", { className: "wiki-playtest-notes" },
            el("h2", { text: "Playtest information" }), el("p", { text: "These published classes are in active testing. Open a class for its current rules." }),
            ...app.wikiPlaytests.map(rule => el("a", { text: `${rule.name} · Alpha ${rule.version}`,
                attributes: { href: `${app.hostContext.toolBasePath}/rules/${encodeURIComponent(rule.id)}` } }))));
        container.append(home);
    }
}

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
