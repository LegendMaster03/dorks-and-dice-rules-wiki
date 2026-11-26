import { renderClassOptionContent, installClassReferenceStyles } from "./native-class-option-detail.js";
import { renderNativeClass } from "./native-class-detail.js";
import { renderNativeMonster } from "./native-monster-detail.js";
import { renderConditionDefinition } from "./condition-detail.js";
import { browserHref } from "./rules-browser-routing.js";
import { element, definitionList, badge } from "./ui.js";
import { classReturnLink } from "./native-class-view-state.js";
import { rememberRule } from "./wiki-experience.js";
import { DEFAULT_RULESET_ID, createRulesContext, createRenderLifecycle, validateNativeEnvelope } from "./rules-context.js";
import { createPresentationInput, createRulesetReader, mountNativePresentation } from "./native-presentation.js";
import { renderPackageAttribution } from "./package-attribution.js";
import { createRegisteredNativeRenderers, LEGACY_NATIVE_RENDERER } from "./native-renderer-registration.js";
const label = name => String(name).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ").replace(/^./, value => value.toUpperCase());

// Native content is rendered as text, never injected HTML or executable code.
export function renderNativeValue(value) {
    if (value === null || typeof value !== "object") return element("span", { text: value === null ? "None" : String(value) });
    if (Array.isArray(value)) {
        return element("ul", { className: "mb-0" }, ...value.map(item => element("li", {}, renderNativeValue(item))));
    }
    return element("dl", { className: "row mb-0" }, ...Object.entries(value).flatMap(([key, item]) => [
        element("dt", { className: "col-sm-4", text: label(key) }),
        element("dd", { className: "col-sm-8" }, renderNativeValue(item))
    ]));
}
const directLifecycles = new WeakMap();

/** One registry per hosted application; direct fixture calls use the same composition root. */
export function createWikiNativeRendererRegistry(app = null) {
    return createRegisteredNativeRenderers(input => {
        const staging = element("div");
        renderLegacyNativeDetail(staging, {
            rulesetId: input.context.rulesetId, fingerprint: input.context.fingerprint, rule: input.rule
        }, input.onBack, app, input.references);
        staging.querySelector(".rules-core-library-detail-body")?.append(
            renderPackageAttribution(input.context, input.packageDescriptor));
        return [...staging.childNodes];
    });
}

/** Active dispatcher. The supplied context is the requested snapshot, not a
 * fallback inferred from a failed foreign read. Existing synchronous callers
 * retain synchronous mounting; asynchronous adapters return a Promise<boolean>. */
export function renderNativeDetail(container, detail, onBack, app = null, options = {}) {
    const context = createRulesContext(options.context ?? detail);
    validateNativeEnvelope(context, options.ruleId ?? detail.rule?.id, detail);
    let lifecycle = options.lifecycle;
    if (!lifecycle) {
        if (!directLifecycles.has(container)) directLifecycles.set(container, createRenderLifecycle());
        lifecycle = directLifecycles.get(container).begin(context, detail.rule.id);
    }
    const reader = options.reader ?? (app?.api?.getNativeRule && app?.api?.searchNativeRules
        ? createRulesetReader(app.api, context, context.rulesetId === DEFAULT_RULESET_ID ? app.wikiIndex?.packageDescriptor : null) : null);
    const input = createPresentationInput(context, detail, reader, {
        toolBasePath: app?.hostContext?.toolBasePath ?? "", onBack, lifecycle, originOccurrence: options.originOccurrence ?? null,
        renderSource: app?.renderNativeSource ? value => app.renderNativeSource(value) : null
    });
    const registry = app
        ? (app.nativeRendererRegistry ??= createWikiNativeRendererRegistry(app))
        : createWikiNativeRendererRegistry();
    const selected = registry.select(input);
    if (input.originOccurrence && selected.id !== "origins.characteristic")
        throw new Error("Characteristic occurrence reference unavailable.");
    const result = mountNativePresentation(container, { render: value => selected.render(value) }, input, {
        decorate: content => {
            if (selected.id === LEGACY_NATIVE_RENDERER) return content;
            const tabs = element("div", { className: "rules-core-version-tabs" },
                element("button", { type: "button", className: "btn btn-sm btn-outline-secondary rules-core-library-mobile-back",
                    text: "← Back to list", onClick: onBack }),
                element("span", { className: "rules-core-version-tab is-active", text: context.rulesetId }),
                element("span", { className: "rules-core-version-tabs-context" }, badge(label(input.rule.kind), "secondary")));
            const body = element("div", { className: "rules-core-library-detail-body" });
            body.append(...(Array.isArray(content) ? content : [content]));
            // Generic fallback owns its notice for standalone use. Specialized
            // renderers receive the same notice here, within the render lease.
            if (selected.id !== "generic")
                body.append(renderPackageAttribution(input.context, input.packageDescriptor));
            return [tabs, body];
        }
    });
    // Only a committed first-party view can update the legacy unqualified history.
    // Foreign history will use the qualified keys in the catalog workstream.
    const finish = mounted => {
        if (mounted && lifecycle.isCurrent() && app) {
            if (app.rememberNativeReference) app.rememberNativeReference(context, detail.rule);
            else if (context.rulesetId === DEFAULT_RULESET_ID) rememberRule(detail.rule);
        }
        return mounted;
    };
    return result && typeof result.then === "function" ? result.then(finish) : finish(result);
}

/** Compatibility adapter: preserve the established first-party layout. */
function renderLegacyNativeDetail(container, detail, onBack, app, reader) {
    const payload = detail.rule;
    // Preserve the existing monster/condition detail contracts. Only the
    // class reader needs the inner gameplay definition in a wrapped record.
    const source = payload.definition;
    const backToClass = classReturnLink(source.parentClass ?? source.definition?.parentClass, detail.fingerprint);
    const rule = payload.kind === "class" && source && typeof source === "object"
        && source.id === payload.id && source.definition && typeof source.definition === "object"
        ? { ...payload, definition: source.definition } : payload;
    const tabs = element("div", { className: "rules-core-version-tabs" },
        element("button", { type: "button", className: "btn btn-sm btn-outline-secondary rules-core-library-mobile-back", text: "← Back to list", onClick: onBack }),
        element("span", { className: "rules-core-version-tabs-label", text: "View" }),
        element("span", { className: "rules-core-version-tab is-active", text: "Dorks & Dice" }),
        element("span", { className: "rules-core-version-tabs-context" }, badge(label(rule.kind), "secondary")));
    const body = element("div", { className: "rules-core-library-detail-body" });
    if (backToClass) tabs.prepend(element("a", { className: "wiki-context-back", text: backToClass.label,
        attributes: { href: backToClass.href } }));
    const article = element("article", { className: "rules-core-effective-rule card card-body mb-3" },
        element("h2", { className: "h3", text: rule.name }));
    const classOption = ["patron", "pact", "invocation"].includes(rule.kind);
    if (classOption) {
        installClassReferenceStyles();
        article.classList.add("rules-wiki-native-class-article");
        const hrefForRule = id => app ? browserHref({ ...app,
            browserFilters: { ...app.browserFilters, query: "", sourceCode: "", overridesOnly: false, fieldFilters: {} },
            browserSort: { key: null, direction: "asc" }
        }, `/rules/${encodeURIComponent(id)}`) : `/rules/${encodeURIComponent(id)}`;
        article.replaceChildren(element("div", { className: "native-class-reference native-class-option-page" },
            renderClassOptionContent(payload, { node: element, renderValue: renderNativeValue, hrefForRule })));
    } else if (rule.kind === "monster") {
        // Preserve the existing native monster renderer on Wiki main.
        // Monster content remains owned by its specialized stat-block view.
        article.classList.add("rules-wiki-monster-article");
        article.replaceChildren(renderNativeMonster(payload, renderNativeValue));
    } else if (rule.kind === "class") {
        // The native class document owns the progression. Individual feature
        // definitions remain separate native rules, fetched only on expansion.
        const hrefForRule = id => {
            const path = `/rules/${encodeURIComponent(id)}`;
            if (!app) return path;
            return browserHref({
                ...app,
                browserFilters: { ...app.browserFilters, query: "", sourceCode: "",
                    overridesOnly: false, fieldFilters: {} },
                browserSort: { key: null, direction: "asc" }
            }, path);
        };
        article.classList.add("rules-wiki-native-class-article");
        article.replaceChildren(renderNativeClass(rule, {
            renderValue: renderNativeValue,
            hrefForRule,
            getRule: reader ? id => reader.resolve(id) : null,
            searchRules: reader ? filters => reader.search(filters) : null,
            catalogFingerprint: detail.fingerprint
        }));
    } else if (typeof rule.definition.description === "string") {
        article.append(element("p", { text: rule.definition.description }));
    }
    if (rule.kind === "condition" || rule.kind === "leveled-condition") {
        article.classList.add("rules-wiki-condition-article");
        article.append(renderConditionDefinition(rule.definition, {
            renderRaw: renderNativeValue,
            hrefForCondition: id => {
                const route = `/rules/${encodeURIComponent(id)}`;
                if (!app) return route;
                // Related-condition navigation is a new lookup, not another
                // match within the previous search/filter results.
                return browserHref({
                    ...app,
                    browserFilters: {
                        ...app.browserFilters,
                        query: "",
                        sourceCode: "",
                        overridesOnly: false,
                        fieldFilters: {}
                    },
                    browserSort: { key: null, direction: "asc" }
                }, route);
            }
        }));
    } else if (!classOption && rule.kind !== "class" && rule.kind !== "monster") {
        for (const [key, value] of Object.entries(rule.definition)) {
            if (["id", "name", "kind", "description"].includes(key) || key.startsWith("_")) continue;
            article.append(element("section", { className: "mb-3" },
                element("h3", { className: "h5", text: label(key) }), renderNativeValue(value)));
        }
    }
    body.append(article, element("section", { className: "card card-body rules-core-detail-context-card" },
        element("h3", { className: "h5", text: "Reference context" }),
        definitionList([["Ruleset", detail.rulesetId], ["Native identity", rule.id], ["Category", rule.kind], ["Snapshot", detail.fingerprint]])));
    container.replaceChildren(tabs, body);
    if (backToClass) for (const link of container.querySelectorAll("a[href]")) {
        if (link.getAttribute("href")?.split("?")[0] === backToClass.href.split("?")[0].split("#")[0])
            link.setAttribute("href", backToClass.href);
    }
}
