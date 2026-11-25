/** Presentation routes only. Native identity and authority remain in Rules Core. */
import { DEFAULT_RULESET_ID, catalogRoute, categoryRoute, ruleRoute, createRenderLifecycle } from "./rules-context.js";
import { element as el } from "./ui.js";
import { renderStructuredContent } from "./structured-content.js";
import { renderPackageAttribution } from "./package-attribution.js";

export const ORIGIN_GROUPS = [
    { label: null, views: [["overview", "Character Origins Overview"]] },
    { label: "Origination", views: [["methods", "Origination Methods"], ["biological-origination", "Biological Origination"], ["construct-assembly", "Construct Assembly"]] },
    { label: "Heritage and Manifestations", views: [["species-and-ancestries", "Species and Ancestries"], ["characteristics", "Characteristics"], ["inheritance-and-transformation", "Inheritance and Transformation"]] },
    { label: "Life Experiences", views: [["upbringings", "Upbringings"], ["backgrounds", "Backgrounds"]] }
];
export const CONSTRUCT_SECTIONS = [
    ["components", "Components", "construct-component", "construct-components"],
    ["designs", "Designs", "construct-design", "construct-options"],
    ["enhancements", "Enhancements", "construct-enhancement", "construct-options"],
    ["materials", "Materials", "construct-material", "construct-options"],
    ["power-sources", "Power Sources", "construct-power-source", "construct-options"],
    ["recipes", "Recipes", "crafting-recipe", "construct-options"]
];
const views = new Map(ORIGIN_GROUPS.flatMap(group => group.views));
const sections = new Set(CONSTRUCT_SECTIONS.map(row => row[0]));
const originBase = catalogRoute(DEFAULT_RULESET_ID) + "/origins";
export const ORIGIN_KINDS = new Set(["species", "ancestry", "subspecies", "origin-trait",
    "upbringing", "background", ...CONSTRUCT_SECTIONS.map(row => row[2])]);

export function originsEnabled(reader) {
    return reader?.context?.rulesetId === DEFAULT_RULESET_ID && reader.originReferenceContractVersion === 1;
}

export function originRoute(view = "overview", section = null) {
    if (!views.has(view) || (section !== null && (view !== "construct-assembly" || !sections.has(section))))
        throw new Error("Unknown Origins presentation route.");
    return originBase + "/" + view + (section ? "/" + section : "");
}

/** Recognize only first-party presentation routes; reject foreign or invalid
 * Origins paths rather than treating them as catalog homes. */
export function parseOriginsRoute(path) {
    const segments = String(path ?? "").split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "").split("/");
    if (segments[0] !== "rulesets" || segments[2] !== "origins") return null;
    const [, id, , view, section] = segments;
    if (id !== DEFAULT_RULESET_ID || !views.has(view) || segments.length > 5 ||
        (segments.length === 5 && (view !== "construct-assembly" || !sections.has(section))))
        return { unsupportedRulesContext: true };
    return { rulesetId: DEFAULT_RULESET_ID, qualified: true, originsView: view,
        originsSection: section ?? null };
}

/** Use authoritative kind (never infer it from a display name or ID prefix). */
export function originWorkspaceForRule(rule) {
    if (rule.kind === "species" || rule.kind === "ancestry" || rule.kind === "subspecies") return ["species-and-ancestries", null];
    if (rule.kind === "origin-trait") return ["characteristics", null];
    if (rule.kind === "upbringing") return ["upbringings", null];
    if (rule.kind === "background") return ["backgrounds", null];
    const component = CONSTRUCT_SECTIONS.find(row => row[2] === rule.kind);
    if (component) return ["construct-assembly", component[0]];
    if (rule.id === "rule.creature-origination") return ["methods", null];
    if (rule.id === "rule.species-subspecies-upbringing") return ["overview", null];
    return null;
}
export function originTitle(view) { return views.get(view); }

export function originMenu(app, active, { grouped = true } = {}) {
    const fragment = document.createDocumentFragment();
    for (const group of ORIGIN_GROUPS) {
        if (grouped && group.label) fragment.append(el("span", { className: "wiki-origins-menu-heading", text: group.label }));
        for (const [view, title] of group.views) fragment.append(el("button", { type: "button", text: title,
            attributes: { ...(active === view ? { "aria-current": "page" } : {}) },
            onClick: () => app.navigateOrigins(view) }));
    }
    return fragment;
}

const lives = new WeakMap();
export function cancelOriginsWorkspace(app) {
    lives.get(app)?.cancel();
    lives.delete(app);
}

function link(text, href) {
    return el("a", { text, attributes: { href } });
}

/** A specialized reader returns a detached DOM node (or promise). The owner
 * composes app.originWorkspaceRenderers, keyed by approved view slug.
 * It receives the exact reader, route, lease and qualified href helpers.
 * The shell owns package notice and commits only the current detached result.
 */
export async function renderOriginsWorkspace(app, container, route) {
    cancelOriginsWorkspace(app);
    const reader = app.rulesetReader;
    if (!originsEnabled(reader) || reader.context !== app.rulesContext || route.rulesetId !== reader.context.rulesetId || !views.has(route.originsView)) {
        container.replaceChildren(el("section", { className: "wiki-home" },
            el("h1", { text: "Character Origins unavailable" }),
            el("p", { text: "This authorized catalog does not supply the Origins reference contract." })));
        return;
    }
    const lifecycle = createRenderLifecycle();
    lives.set(app, lifecycle);
    const { originsView: view, originsSection: section } = route;
    const lease = lifecycle.begin(reader.context, "rule.creature-origination");
    const current = () => lease.isCurrent() && lives.get(app) === lifecycle &&
        app.rulesetReader === reader && app.rulesContext === reader.context && container.isConnected;
    const base = (app.hostContext.toolBasePath ?? "/tools/rules-wiki").replace(/\/$/, "");
    const input = Object.freeze({
        reader, context: reader.context, view, section,
        lifecycle: Object.freeze({ ...lease, isCurrent: current }),
        hrefForRule: (id, kind = null) => base + ruleRoute(reader.context.rulesetId, id) +
            (kind ? "?" + new URLSearchParams({ category: kind }).toString() : ""),
        hrefForCategory: kind => base + categoryRoute(reader.context.rulesetId, kind),
        hrefForWorkspace: (next, subsection = null) => base + originRoute(next, subsection)
    });
    container.dataset.rulesView = "origins";
    container.replaceChildren(el("p", { className: "wiki-home", text: "Loading Origins reference…" }));
    try {
        const page = el("section", { className: "wiki-home wiki-origins" });
        page.append(el("nav", { className: "wiki-origins-breadcrumb", ariaLabel: "Origins navigation" },
            link("Character Origins Overview", input.hrefForWorkspace("overview"))));
        page.append(el("h1", { text: originTitle(view) }));
        if (view === "construct-assembly") {
            const nav = el("nav", { className: "wiki-origins-sections", ariaLabel: "Construct Assembly sections" });
            for (const [id, title] of CONSTRUCT_SECTIONS) {
                const item = link(title, input.hrefForWorkspace(view, id));
                if ((section ?? "components") === id) item.setAttribute("aria-current", "page");
                nav.append(item);
            }
            page.append(nav);
        }
        const render = app.originWorkspaceRenderers?.[view];
        // B retains its own overview and methods reader. The other views have
        // bounded native fallbacks until their specialized readers are registered.
        const body = await (view !== "overview" && view !== "methods" && typeof render === "function"
            ? render(input) : renderFallback(input));
        if (!current()) return;
        page.append(body, renderPackageAttribution(reader.context, reader.packageDescriptor));
        container.replaceChildren(page);
    } catch {
        if (!current()) return;
        container.replaceChildren(el("section", { className: "wiki-home" },
            el("h1", { text: "Origins reference unavailable" }),
            el("p", { text: "The reference could not be read in the current authorized snapshot. Refresh the ruleset or retry." }),
            el("button", { type: "button", text: "Retry", onClick: () => app.render() })));
    }
}

async function renderFallback(input) {
    const { reader, view, section, hrefForRule, hrefForWorkspace, hrefForCategory } = input;
    const body = el("div", { className: "wiki-origins-content" });
    if (view === "overview") {
        // Resolve the authored rules, not a cached copy or historical review note.
        const rules = await Promise.all(["rule.creature-origination", "rule.species-subspecies-upbringing"]
            .map(id => reader.resolve(id)));
        body.append(el("p", { text: "Origination describes how a character comes into existence. Heritage identifies the sources of inherent characteristics; Manifestations describe their expression. Life Experiences cover Upbringings and Backgrounds." }),
            el("p", { text: "Biological Origination and Construct Assembly are distinct families. This is a reference to authored rules and options, not a character builder or a guarantee that every method is executable." }),
            el("h2", { text: "Rules reference" }),
            el("ul", {}, ...rules.map(({ rule }) => el("li", {}, link(rule.name, hrefForRule(rule.id, rule.kind))))));
        const grid = el("div", { className: "wiki-home-grid" });
        for (const group of ORIGIN_GROUPS.filter(group => group.label)) grid.append(
            el("section", { className: "wiki-home-category" }, el("h2", { text: group.label }),
                el("ul", {}, ...group.views.map(([id, title]) => el("li", {}, link(title, hrefForWorkspace(id)))))));
        body.append(grid);
        return body;
    }
    if (view === "methods" || view === "inheritance-and-transformation") {
        const envelope = await reader.originMethods();
        const rows = view === "methods" ? envelope.methods : envelope.methods.filter(m => m.createsNewIndividual === false);
        body.append(el("p", { text: "Authored method references only. Defaults and support descriptors do not establish executable availability. Unspecified fields remain unspecified." }),
            link("Creature Origination rules", hrefForRule("rule.creature-origination")));
        if (view === "inheritance-and-transformation") body.append(el("p", { text: "This list contains only methods explicitly marked as changing an existing individual." }),
            link("Species, Ancestries and Upbringing rules", hrefForRule("rule.species-subspecies-upbringing")));
        if (!rows.length) body.append(el("p", { text: "No matching method definitions are available in this snapshot." }));
        for (const method of rows) {
            const fields = [
                ["Stage", method.stage], ["Creates a new individual", method.createsNewIndividual],
                ["Operation", method.operation], ["Support", method.support],
                ["Authored default availability", method.defaultAvailability], ["Specializes", method.specializes]
            ];
            const details = el("dl");
            for (const [label, value] of fields) details.append(el("dt", { text: label }),
                el("dd", {}, value == null ? el("span", { text: "Not specified" }) : renderStructuredContent(value)));
            if (method.definingCreatureTypeId) details.append(el("dt", { text: "Defining creature type" }),
                el("dd", {}, link(method.definingCreatureTypeId, hrefForRule(method.definingCreatureTypeId))));
            body.append(el("section", { className: "wiki-home-category wiki-origin-method" },
                el("h2", { text: method.name ?? method.reference.methodId }), details));
        }
        return body;
    }
    let family, kind;
    if (view === "construct-assembly") {
        const entry = CONSTRUCT_SECTIONS.find(row => row[0] === (section ?? "components"));
        [, , kind, family] = entry;
    } else family = {
        "biological-origination": "biological", "species-and-ancestries": "biological",
        characteristics: "characteristics", upbringings: "upbringing", backgrounds: "backgrounds"
    }[view];
    if (!family) throw new Error("No reference workspace for this view.");
    const hierarchy = await reader.originHierarchy(family);
    const rows = hierarchy.rows.filter(row => !kind || row.kind === kind);
    const byId = new Map(rows.map(row => [row.id, row]));
    if (view === "biological-origination") body.append(el("p", { text: "Biological sources and their authored lineage. Consult Origination Methods for method support and creation-stage details." }),
        link("Origination Methods", hrefForWorkspace("methods")));
    if (view === "construct-assembly") body.append(link("Related operational characteristics", hrefForWorkspace("characteristics")));
    // A bounded reference index, not a specialized source or effective-grant
    // renderer. Parent labels come only from the authoritative family projection.
    const kinds = [...new Set(rows.map(row => row.kind))];
    const categories = el("nav", { className: "wiki-origins-sections", ariaLabel: "Native reference categories" });
    for (const type of kinds) categories.append(link("Browse " + type, hrefForCategory(type)));
    body.append(categories);
    const list = el("ul", { className: "wiki-origins-records" });
    for (const row of rows) {
        const item = el("li", {}, link(row.name, hrefForRule(row.id, row.kind)));
        if (row.parentId && byId.has(row.parentId)) item.append(el("span", { className: "wiki-muted", text: " — Parent: " + byId.get(row.parentId).name }));
        if (row.selectable === false) item.append(el("span", { className: "wiki-muted", text: " — Not independently selectable" }));
        const status = row.rulesStatus ?? row.status;
        if (status) item.append(el("span", { className: "wiki-muted", text: " — " + status }));
        list.append(item);
    }
    body.append(el("p", { text: rows.length + " reference records. Open a record for its authored details." }), list);
    return body;
}
