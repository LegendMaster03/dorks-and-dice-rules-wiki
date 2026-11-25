/** Shared reference identity, never an authorization decision. */
export const DEFAULT_RULESET_ID = "first-party-001";
function required(value, label, pattern = null) {
    if (typeof value !== "string" || !value.trim() || value !== value.trim() ||
        (pattern && !pattern.test(value))) throw new Error("Invalid " + label + ".");
    return value;
}
export const rulesetIdentity = id => required(id, "ruleset identity", /^[a-z0-9-]{1,80}$/);
export function nativeRuleIdentity(id) {
    if (typeof id !== "string" || id.length > 160) throw new Error("Invalid native rule identity.");
    return required(id, "native rule identity", /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/);
}
export function createRulesContext({ rulesetId, fingerprint, campaignId = null, campaignRevisionId = null }) {
    rulesetIdentity(rulesetId);
    required(fingerprint, "catalog fingerprint");
    if (campaignId !== null) required(campaignId, "campaign identity");
    if (campaignRevisionId !== null) {
        if (campaignId === null) throw new Error("Campaign revision requires campaign identity.");
        required(campaignRevisionId, "campaign revision identity");
    }
    return Object.freeze({ rulesetId, fingerprint, campaignId, campaignRevisionId });
}
export function requireBaseContext(context) {
    const c = createRulesContext(context);
    if (c.campaignId !== null) throw new Error("Campaign rules are not available in the native Core yet.");
    return c;
}
export function referenceKey(rulesetId, ruleId) {
    return JSON.stringify([rulesetIdentity(rulesetId), nativeRuleIdentity(ruleId)]);
}
export function snapshotKey(context, ...parts) {
    const c = createRulesContext(context);
    if (c.campaignId !== null && c.campaignRevisionId === null)
        throw new Error("Campaign snapshot revision is unavailable.");
    return JSON.stringify([c.rulesetId, c.fingerprint, c.campaignId, c.campaignRevisionId, ...parts]);
}
export function readingKey(context, ruleId, view = "detail") {
    return snapshotKey(context, "reading", nativeRuleIdentity(ruleId), required(view, "reading view"));
}
export function catalogRoute(rulesetId) {
    return "/rulesets/" + encodeURIComponent(rulesetIdentity(rulesetId));
}
const categoryIdentity = id => required(id, "category", /^[a-zA-Z][a-zA-Z0-9-]{0,79}$/);
export function categoryRoute(rulesetId, category) {
    return catalogRoute(rulesetId) + "/types/" + encodeURIComponent(categoryIdentity(category));
}
export function ruleRoute(rulesetId, ruleId) {
    return catalogRoute(rulesetId) + "/rules/" + encodeURIComponent(nativeRuleIdentity(ruleId));
}
/** Null denotes a legacy path, not an invalid qualified path. */
export function parseQualifiedRoute(path) {
    const segments = String(path ?? "").split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "").split("/");
    if (segments[0] !== "rulesets") return null;
    try {
        const rulesetId = rulesetIdentity(decodeURIComponent(segments[1] ?? ""));
        if (segments.length === 2) return { status: "valid", rulesetId, kind: "catalog" };
        if (segments.length === 4 && segments[2] === "rules")
            return { status: "valid", rulesetId, kind: "rule", ruleId: nativeRuleIdentity(decodeURIComponent(segments[3])) };
        if (segments.length === 4 && segments[2] === "types")
            return { status: "valid", rulesetId, kind: "category", category: categoryIdentity(decodeURIComponent(segments[3])) };
    } catch { /* Invalid URL escape or identity. */ }
    return { status: "invalid" };
}
export function assertSnapshot(context, response) {
    if (!response || response.rulesetId !== context.rulesetId || response.fingerprint !== context.fingerprint)
        throw new Error("Native catalog identity did not match the requested snapshot.");
    return response;
}
/** Only Core's exact permitted descriptor establishes a context. */
export async function discoverRulesContext(api, rulesetId) {
    rulesetIdentity(rulesetId);
    const response = await api.getNativeRulesets();
    const matches = response.rulesets?.filter(entry => entry.id === rulesetId) ?? [];
    if (matches.length !== 1 || matches[0].capabilities?.read !== true)
        throw new Error("The requested ruleset is unavailable or unauthorized.");
    return createRulesContext({ rulesetId, fingerprint: matches[0].fingerprint });
}
export function validateNativeEnvelope(context, ruleId, response) {
    assertSnapshot(requireBaseContext(context), response);
    const rule = response.rule;
    if (!rule || rule.id !== nativeRuleIdentity(ruleId) || typeof rule.name !== "string" ||
        !rule.name.trim() || typeof rule.kind !== "string" || !rule.kind.trim() ||
        !rule.definition || typeof rule.definition !== "object" || Array.isArray(rule.definition))
        throw new Error("Invalid native entity envelope.");
    return response;
}
/** One lease per mounted surface. Check it after every await and cancel on teardown. */
export function createRenderLifecycle() {
    let active = null;
    return Object.freeze({
        begin(context, ruleId) {
            const key = readingKey(context, ruleId);
            active?.controller.abort();
            const controller = new AbortController();
            const token = { key, controller };
            active = token;
            return Object.freeze({ key, signal: controller.signal,
                isCurrent: () => active === token && !controller.signal.aborted });
        },
        cancel() { active?.controller.abort(); active = null; }
    });
}
