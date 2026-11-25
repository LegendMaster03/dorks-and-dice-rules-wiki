/** Native presentation adapters use the existing private transport. */
import { requireBaseContext, validateNativeEnvelope, assertSnapshot, nativeRuleIdentity, ruleRoute } from "./rules-context.js";
import { packageDescriptor, renderPackageAttribution } from "./package-attribution.js";
import { renderStructuredContent } from "./structured-content.js";
export function createRulesetReader(api, context, descriptor = null) {
    const c = requireBaseContext(context);
    return Object.freeze({
        context: c,
        packageDescriptor: packageDescriptor(c, descriptor),
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
        packageDescriptor: packageDescriptor(c, reader?.packageDescriptor ?? null),
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
export { renderStructuredContent } from "./structured-content.js";
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
        renderStructuredContent(input.record, { input }), renderNativeAttribution(input),
        renderPackageAttribution(input.context, input.packageDescriptor));
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
        const rendered = Array.isArray(result) ? result : [result];
        if (!rendered.length || !rendered.every(node => node instanceof Node))
            throw new Error("Native renderer must return DOM nodes.");
        const content = decorate(result);
        if (!lease.isCurrent()) return false;
        const nodes = Array.isArray(content) ? content : [content];
        if (!nodes.length || !nodes.every(node => node instanceof Node)) throw new Error("Native renderer must return DOM nodes.");
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
