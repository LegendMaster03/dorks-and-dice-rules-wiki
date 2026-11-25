import { renderNativeClass } from "./native-class-detail.js";
import { installClassReferenceStyles } from "./native-class-option-detail.js";
import { createImportedClassPresentation, importedClassKind, createImportedFeatureResolver, nativeClassReferences } from "./native-class-presentation-model.js";
import { importedClassSections, classRuleLink } from "./native-imported-class-sections.js";
import { classReturnLink } from "./native-class-view-state.js";
import { renderStructuredContent, renderNativeAttribution } from "./native-presentation.js";

const node = (tag, text) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    return el;
};
function renderImportedClass(input) {
    const presentation = createImportedClassPresentation(input.record);
    const getRule = input.references ? createImportedFeatureResolver(presentation, input.references, input.context,
        () => !input.lifecycle || input.lifecycle.isCurrent()) : null;
    const root = renderNativeClass(input.rule, {
        presentation, context: input.context, lifecycle: input.lifecycle,
        catalogFingerprint: input.context.fingerprint,
        renderValue: value => renderStructuredContent(value, { input }),
        hrefForRule: input.hrefForRule, getRule,
        additionalSections: importedClassSections(input, presentation)
    });
    root.append(renderNativeAttribution(input));
    return root;
}
function renderImportedFeature(input) {
    const record = input.record;
    installClassReferenceStyles();
    const root = node("article");
    root.className = "native-class-reference native-class-option-page";
    root.append(node("h2", input.rule.name));
    const parents = input.rule.kind === "optional-feature"
        ? [...nativeClassReferences(record, "subclass"), ...nativeClassReferences(record, "class")]
        : nativeClassReferences(record, input.rule.kind === "subclass-feature" ? "subclass" : "class");
    for (const id of parents) {
        const back = classReturnLink(id, input.context.fingerprint, input.context);
        if (back) {
            const link = node("a", back.label);
            link.className = "wiki-context-back";
            link.setAttribute("href", back.href);
            root.append(link);
        } else root.append(classRuleLink(input, id, "Related class reference: " + id));
    }
    if (Number.isInteger(record.level)) root.append(node("p", "Class level " + record.level));
    if (record.prerequisite !== undefined) root.append(node("h3", "Prerequisites"), renderStructuredContent(record.prerequisite, { input }));
    root.append(renderStructuredContent(record.entries, { input }));
    const related = node("section");
    related.append(node("h3", "Related references"));
    for (const id of record.catalogReferences ?? []) {
        try {
            if (!parents.includes(id)) related.append(classRuleLink(input, id));
        } catch { /* Only valid native IDs are links. The complete data remains visible. */ }
    }
    root.append(related);
    const raw = node("details");
    raw.append(node("summary", "Complete authoritative feature record"), renderStructuredContent(record, { input }));
    root.append(raw, renderNativeAttribution(input));
    return root;
}
/** Structural adapters share the existing native class reading surface. The
 * foundation's first-party compatibility path remains unchanged. */
export function registerNativeRenderers(registry) {
    registry.register({ id: "class.imported-family", priority: 20,
        supports: input => importedClassKind(input.record) === input.rule.kind &&
            input.record.id === input.rule.id,
        render: renderImportedClass });
    registry.register({ id: "class.imported-feature", priority: 20,
        supports: input => ["class-feature", "subclass-feature"].includes(input.rule.kind) &&
            input.record.kind === input.rule.kind && input.record.id === input.rule.id &&
            typeof input.record.className === "string" && Number.isInteger(input.record.level) &&
            Array.isArray(input.record.entries),
        render: renderImportedFeature });
    // Class-owned optional features use the same feature reader. General feats
    // and other option records remain available to the reference workstream.
    registry.register({ id: "class.imported-option", priority: 20,
        supports: input => input.rule.kind === "optional-feature" && input.record.kind === input.rule.kind &&
            input.record.id === input.rule.id && Array.isArray(input.record.featureType) &&
            Array.isArray(input.record.entries) && (nativeClassReferences(input.record, "class").length > 0 ||
                nativeClassReferences(input.record, "subclass").length > 0),
        render: renderImportedFeature });
}
