// Structured native JSON renderer. Treat all catalog values as untrusted text.
const label = name => String(name).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());

function node(tag, className, value) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (value !== undefined) result.textContent = String(value);
    return result;
}

function renderValue(value) {
    if (value === null || typeof value !== "object") {
        return node("span", "native-value", value === null ? "None" : value);
    }
    if (Array.isArray(value)) {
        const list = node("ol", "native-value-list");
        for (const item of value) {
            const entry = node("li");
            entry.append(renderValue(item));
            list.append(entry);
        }
        if (!value.length) list.append(node("li", "native-empty", "None"));
        return list;
    }
    const definition = node("dl", "native-definition");
    for (const [key, item] of Object.entries(value)) {
        definition.append(node("dt", "", label(key)), node("dd"));
        definition.lastChild.append(renderValue(item));
    }
    return definition;
}

export function renderNativeDetail(container, detail, onBack) {
    container.replaceChildren();
    const rule = detail?.rule;
    if (!rule || !rule.definition) {
        container.append(node("p", "native-error", "Native rule detail is unavailable."));
        return;
    }
    const back = node("button", "native-back", "Back to results");
    back.type = "button";
    back.addEventListener("click", onBack);
    const title = node("h2", "native-detail-title", rule.name);
    const kind = node("p", "native-kind", label(rule.kind));
    const identity = node("code", "native-id", rule.id);
    const body = node("article", "native-rule-document");
    const document = rule.definition;
    if (typeof document.description === "string") {
        body.append(node("p", "native-description", document.description));
    }
    for (const [key, value] of Object.entries(document)) {
        if (["id", "name", "kind", "description"].includes(key) || key.startsWith("_")) continue;
        const section = node("section", "native-rule-section");
        section.append(node("h3", "", label(key)), renderValue(value));
        body.append(section);
    }
    container.append(back, title, kind, identity, body);
}
