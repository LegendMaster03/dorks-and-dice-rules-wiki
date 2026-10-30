import { renderConditionDefinition } from "./condition-detail.js";
import { browserHref } from "./rules-browser-routing.js";
import { element, definitionList, badge } from "./ui.js";
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
export function renderNativeDetail(container, detail, onBack, app = null) {
    const rule = detail.rule;
    if (!rule || !rule.definition) throw new Error("Native rule detail is unavailable.");
    const tabs = element("div", { className: "rules-core-version-tabs" },
        element("button", { type: "button", className: "btn btn-sm btn-outline-secondary rules-core-library-mobile-back", text: "← Back to list", onClick: onBack }),
        element("span", { className: "rules-core-version-tabs-label", text: "View" }),
        element("span", { className: "rules-core-version-tab is-active", text: "Dorks & Dice" }),
        element("span", { className: "rules-core-version-tabs-context" }, badge(label(rule.kind), "secondary")));
    const body = element("div", { className: "rules-core-library-detail-body" });
    const article = element("article", { className: "rules-core-effective-rule card card-body mb-3" },
        element("h2", { className: "h3", text: rule.name }));
    if (typeof rule.definition.description === "string") article.append(element("p", { text: rule.definition.description }));
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
    } else {
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
}
