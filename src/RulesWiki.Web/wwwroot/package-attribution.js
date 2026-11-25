/** Package metadata is consumer display data, never a local access grant. */
import { createRulesContext, requireBaseContext, rulesetIdentity } from "./rules-context.js";
const text = value => typeof value === "string" && value.trim() ? value : null;
const strings = value => Object.freeze(Array.isArray(value) ? value.map(text).filter(Boolean) : []);
function safeUrl(value) {
    if (!text(value)) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}
/** Validate an exact descriptor; project only consumer-facing fields. */
export function packageDescriptor(context, descriptor) {
    const c = requireBaseContext(context);
    if (!descriptor || descriptor.id !== c.rulesetId || descriptor.fingerprint !== c.fingerprint ||
        descriptor.capabilities?.read !== true) return null;
    const m = descriptor.metadata;
    const metadata = m && typeof m === "object" && m.rulesetId === c.rulesetId ? Object.freeze({
        rulesetId: c.rulesetId,
        displayName: text(m.displayName), sourceSystem: text(m.sourceSystem), sourceEdition: text(m.sourceEdition),
        sourcePublication: text(m.sourcePublication), sourceVersion: text(m.sourceVersion),
        licenseIdentifier: text(m.licenseIdentifier), licenseUrl: safeUrl(m.licenseUrl),
        attributionStatement: text(m.attributionStatement), copyrightNotices: strings(m.copyrightNotices),
        originalSources: Object.freeze(strings(m.originalSources).map(safeUrl).filter(Boolean)),
        modificationNotices: strings(m.modificationNotices), acknowledgments: strings(m.acknowledgments)
    }) : null;
    return Object.freeze({ id: c.rulesetId, fingerprint: c.fingerprint,
        capabilities: Object.freeze({ read: true, write: false }), metadata });
}
/** Use the same authorized index response to establish both identity and attribution. */
export async function discoverPackageContext(api, rulesetId) {
    rulesetIdentity(rulesetId);
    const response = await api.getNativeRulesets();
    const matches = Array.isArray(response?.rulesets) ? response.rulesets.filter(x => x?.id === rulesetId) : [];
    if (matches.length !== 1 || matches[0].capabilities?.read !== true)
        throw new Error("The requested ruleset is unavailable or unauthorized.");
    const context = createRulesContext({ rulesetId, fingerprint: matches[0].fingerprint });
    return Object.freeze({ context, descriptor: packageDescriptor(context, matches[0]) });
}
export function packageDisplayName(context, descriptor) {
    const c = requireBaseContext(context);
    return packageDescriptor(c, descriptor)?.metadata?.displayName ?? c.rulesetId;
}
const node = (tag, value) => {
    const el = document.createElement(tag);
    if (value !== undefined) el.textContent = value;
    return el;
};
function link(url, label) {
    const a = node("a", label);
    a.href = url; a.rel = "noopener noreferrer";
    return a;
}
/** Detached, reusable attribution view for a landing page or a reference detail. */
export function renderPackageAttribution(context, descriptor) {
    const c = requireBaseContext(context);
    const m = packageDescriptor(c, descriptor)?.metadata;
    const section = node("section");
    section.className = "rules-core-detail-context-card card card-body ruleset-package-attribution";
    section.append(node("h3", "Ruleset attribution"), node("p", m?.displayName ?? c.rulesetId));
    if (!m) {
        section.append(node("p", "Package attribution metadata is unavailable."));
        return section;
    }
    const source = [m.sourceSystem, m.sourceEdition, m.sourcePublication, m.sourceVersion].filter(Boolean);
    if (source.length) section.append(node("p", source.join(" · ")));
    const license = node("p");
    if (m.licenseIdentifier && m.licenseUrl) license.append(link(m.licenseUrl, m.licenseIdentifier));
    else if (m.licenseIdentifier) license.append(node("span", m.licenseIdentifier + " (license link unavailable)"));
    else license.append(node("span", "No package-wide license supplied."));
    section.append(license);
    for (const notice of [...m.copyrightNotices, m.attributionStatement, ...m.modificationNotices].filter(Boolean))
        section.append(node("p", notice));
    if (m.originalSources.length) {
        section.append(node("h4", "Original sources"));
        const list = node("ul");
        for (const url of m.originalSources) {
            const item = node("li"); item.append(link(url, url)); list.append(item);
        }
        section.append(list);
    }
    if (m.acknowledgments.length) {
        section.append(node("h4", "Acknowledgments"));
        for (const notice of m.acknowledgments) section.append(node("p", notice));
    }
    return section;
}
