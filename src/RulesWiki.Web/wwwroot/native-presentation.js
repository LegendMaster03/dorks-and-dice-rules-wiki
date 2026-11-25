/** Native presentation adapters use the existing private transport. */
import { requireBaseContext, validateNativeEnvelope, assertSnapshot, nativeRuleIdentity, ruleRoute } from "./rules-context.js";
export function createRulesetReader(api, context) {
    const c = requireBaseContext(context);
    return Object.freeze({
        context: c,
        async search(filters = {}) {
            const response = assertSnapshot(c, await api.searchNativeRules(c.rulesetId, filters));
            if (!Array.isArray(response.rules) || !Number.isInteger(response.total) || response.total < 0)
                throw new Error("Invalid native catalog response.");
            return response;
        },
        async resolve(ruleId) {
            nativeRuleIdentity(ruleId);
            return validateNativeEnvelope(c, ruleId, await api.getNativeRule(c.rulesetId, ruleId));
        },
        hrefForRule(ruleId) { return ruleRoute(c.rulesetId, ruleId); }
    });
}
/** Preserve the entire native record, including schema-specific wrappers. */
export function createPresentationInput(context, envelope, reader, options = {}) {
    const c = requireBaseContext(context);
    const rule = validateNativeEnvelope(c, envelope?.rule?.id, envelope).rule;
    if (reader && Object.keys(c).some(key => reader.context[key] !== c[key]))
        throw new Error("Reference reader does not match the presentation context.");
    const record = rule.definition;
    return Object.freeze({ context: c, rule, record,
        source: record.source ?? record.definition?.source ?? null,
        sourcePackage: record.sourcePackage ?? record.definition?.sourcePackage ?? null,
        references: reader ?? null,
        hrefForRule: id => (options.toolBasePath ?? "").replace(/\/$/, "") + ruleRoute(c.rulesetId, id),
        renderSource: options.renderSource ?? null,
        onBack: options.onBack ?? null,
        lifecycle: options.lifecycle ?? null });
}
export function createNativeRendererRegistry(fallback = renderGenericNative) {
    const entries = new Map();
    const select = input => {
        const matches = [...entries.values()].filter(entry => entry.supports(input))
            .sort((a, b) => b.priority - a.priority);
        if (matches.length > 1 && matches[0].priority === matches[1].priority)
            throw new Error("Ambiguous native renderer registration.");
        return matches[0] ?? { id: "generic", render: fallback };
    };
    return Object.freeze({
        register({ id, supports, render, priority = 0 }) {
            if (typeof id !== "string" || !id || entries.has(id) || typeof supports !== "function" ||
                typeof render !== "function" || !Number.isFinite(priority)) throw new Error("Invalid native renderer registration.");
            entries.set(id, Object.freeze({ id, supports, render, priority }));
        },
        select,
        render(input) { return select(input).render(input); }
    });
}
const node = (tag, text) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = String(text);
    return value;
};
const append = (parent, child) => { parent.append(child); return parent; };
/** Render unknown shapes without interpreting HTML, Markdown or inline tags. */
export function renderStructuredContent(value) {
    if (value === null || typeof value !== "object") return node("span", value === null ? "None" : String(value));
    if (Array.isArray(value)) {
        const list = node("ul");
        for (const item of value) list.append(append(node("li"), renderStructuredContent(item)));
        return list;
    }
    if (Array.isArray(value.rows) && value.rows.every(Array.isArray) &&
        (value.type === "table" || Array.isArray(value.colLabels))) {
        const wrapper = node("div"), table = node("table");
        if (typeof value.name === "string" || typeof value.caption === "string")
            table.append(node("caption", value.caption ?? value.name));
        if (Array.isArray(value.colLabels)) {
            const row = node("tr");
            for (const label of value.colLabels) {
                const cell = append(node("th"), renderStructuredContent(label));
                cell.scope = "col"; row.append(cell);
            }
            table.append(append(node("thead"), row));
        }
        const body = node("tbody");
        for (const sourceRow of value.rows) {
            const row = node("tr");
            for (const cell of sourceRow) row.append(append(node("td"), renderStructuredContent(cell)));
            body.append(row);
        }
        table.append(body); wrapper.append(table);
        const extras = Object.fromEntries(Object.entries(value).filter(([key]) =>
            !["type", "name", "caption", "colLabels", "rows"].includes(key)));
        if (Object.keys(extras).length) wrapper.append(renderStructuredContent(extras));
        return wrapper;
    }
    const definition = node("dl");
    for (const [key, entry] of Object.entries(value))
        definition.append(node("dt", key), append(node("dd"), renderStructuredContent(entry)));
    return definition;
}
export function renderNativeAttribution(input) {
    const section = node("section");
    section.append(node("h3", "Source and attribution"));
    if (input.renderSource) {
        const custom = input.renderSource(input);
        if (custom) section.append(custom);
    } else {
        if (input.source !== null) section.append(renderStructuredContent(input.source));
        if (input.sourcePackage !== null) section.append(renderStructuredContent(input.sourcePackage));
        if (input.source === null && input.sourcePackage === null)
            section.append(node("p", "Source attribution is not supplied in this native record."));
    }
    return section;
}
export function renderGenericNative(input) {
    const article = node("article");
    article.append(node("h2", input.rule.name),
        node("p", "Generic native reference · " + input.context.rulesetId + " · " + input.rule.kind),
        renderStructuredContent(input.record), renderNativeAttribution(input));
    return article;
}
/** Mount synchronous and asynchronous renderers through the same current lease.
 * A renderer may return a node or an array of detached nodes (legacy adapter).
 * decorate runs only for a current result and must return the final node(s). */
export function mountNativePresentation(container, registry, input, { decorate = result => result } = {}) {
    const lease = input.lifecycle;
    if (!lease || typeof lease.isCurrent !== "function") throw new Error("A render lease is required.");
    if (!lease.isCurrent()) return false;
    const commit = result => {
        if (!lease.isCurrent()) return false;
        const content = decorate(result);
        if (!lease.isCurrent()) return false;
        const nodes = Array.isArray(content) ? content : [content];
        if (!nodes.every(node => node instanceof Node)) throw new Error("Native renderer must return DOM nodes.");
        container.replaceChildren(...nodes);
        return true;
    };
    const failed = error => {
        if (!lease.isCurrent()) return false;
        throw error;
    };
    try {
        const result = registry.render(input);
        return result && typeof result.then === "function"
            ? Promise.resolve(result).then(commit).catch(failed)
            : commit(result);
    } catch (error) { return failed(error); }
}
