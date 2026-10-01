export class RulesCoreHttpError extends Error {
    constructor(message, status, details = null) {
        super(message);
        this.name = "RulesCoreHttpError";
        this.status = status;
        this.details = details;
    }
}

export async function loadToolHostContext(root) {
    const contextUrl = root.dataset.toolContextUrl;
    if (!contextUrl) throw new Error("The Tool Host did not provide a context URL.");
    return requestJson(contextUrl, { method: "GET" });
}

const PRIVATE_OPERATIONS = new Set([
    "searchSourceEntities", "searchSourceEntityPage", "getCurrentUserSources",
    "getCurrentUserSourceImportJobs", "dismissCurrentUserSourceImportJobs",
    "getCurrentUserSourceReconciliationIssues", "getCurrentUserSourceImportJobReconciliationIssues",
    "addCurrentUserSource", "refreshCurrentUserSource", "removeCurrentUserSource",
    "previewSourceDocument", "importSourceDocument", "findHostedSourceMatches",
    "getBundledSrds", "reprocessBundledSrd", "getHostedSources", "getHostedSource",
    "setHostedSource", "previewHostedSource", "refreshHostedSource",
    "getSourceAdministrationPackages", "grantCurrentUserSourcePackage", "revokeCurrentUserSourcePackage",
    "getCurrentUserSourceAcquisitions", "recordCurrentUserSourceAcquisition", "voidCurrentUserSourceAcquisition",
    "getSourceNormalizationCandidates", "acceptSourceNormalization", "detectSourceVersions",
    "bindDetectedSourceVersion", "createSourceLineage", "voidSourceLineage", "getRuleConsolidation",
    "getSourceRevisionUpdates", "previewSourceRevisionUpdate", "adoptLatestSourceRevision",
    "rejectLatestSourceRevision", "createGlobalConcept", "bindGlobalConceptSource",
    "getGlobalAuthoringOverview", "getGlobalAuthoringConcept", "previewGlobalDecision",
    "discoverAdjudicationWork", "getAdjudicationWork", "getAdjudicationWorkItem",
    "beginAdjudicationWork", "requestAdjudicationClarification", "answerAdjudicationClarification",
    "escalateAdjudicationWork", "deferAdjudicationWork", "reopenAdjudicationWork",
    "publishGlobalRules", "getCampaignAuthoringOverview", "getCampaignAuthoringConcept",
    "getCampaignBaselineCandidates", "previewCampaignBaseline", "previewCampaignDecision",
    "saveCampaignDecision", "publishCampaignRules", "selectCampaignBaseline"
]);

const PUBLIC_CORE_METHODS = new Set([
    "getGlobalRulesCatalog", "getCampaignRulesCatalog", "getGlobalResolvedRule",
    "getCampaignResolvedRule", "getRuleVersions", "compareRuleVersions"
]);

// Reference browsing still supports these UI-level filters; rules-reference-api.js owns their
// private Wiki semantics and this client never translates them into public Rules Core calls.
const PRIVATE_REFERENCE_FILTER_FIELDS = Object.freeze(["sourceCode", "overridesOnly"]);

export class RulesCoreApi {
    constructor(hostContext) {
        if (!hostContext?.apiBaseUrl) throw new Error("The Tool Host context did not include an API base URL.");
        this.hostContext = hostContext;
        this.hostApiBaseUrl = trimTrailingSlash(hostContext.apiBaseUrl);
        this.operationBaseUrl = `${this.hostApiBaseUrl}/upstream/_rules-wiki/operations`;
        this.privateReferenceFilterFields = PRIVATE_REFERENCE_FILTER_FIELDS;

        return new Proxy(this, {
            get(target, property, receiver) {
                if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
                if (property === "then") return undefined;
                if (typeof property !== "string") return undefined;
                if (PRIVATE_OPERATIONS.has(property)) return (...args) => target.operation(property, args);
                if (PUBLIC_CORE_METHODS.has(property)) {
                    return () => Promise.reject(new Error(
                        `Rules Wiki can not use the public Rules Core operation '${property}'. Use the private Wiki reference contract instead.`));
                }
                return undefined;
            }
        });
    }

    getSession() { return requestJson(`${this.hostApiBaseUrl}/session`, { method: "GET" }); }
    getCampaigns() { return requestJson(`${this.hostApiBaseUrl}/campaigns`, { method: "GET" }); }

    async getOptionalSession() {
        try { return await this.getSession(); }
        catch (error) { if (isAnonymousAccessError(error)) return null; throw error; }
    }

    async getOptionalCampaigns() {
        try { return await this.getCampaigns(); }
        catch (error) { if (isAnonymousAccessError(error)) return []; throw error; }
    }

    async saveGlobalDecision(conceptId, payload) {
        const result = await this.operation("saveGlobalDecision", [conceptId, payload]);
        return { ...result.value, created: result.created };
    }

    operation(name, args = []) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error("Invalid Rules Wiki UI operation name.");
        return requestJson(`${this.operationBaseUrl}/${encodeURIComponent(name)}`, {
            method: "POST",
            body: { arguments: args }
        });
    }

    backend(path, options = {}) {
        const translated = translateLegacyPrivatePath(path, options);
        return this.operation(translated.operation, translated.arguments);
    }
}

function translateLegacyPrivatePath(path, options = {}) {
    if (!path.startsWith("/")) throw new Error("Backend paths must start with '/'.");
    const url = new URL(path, "https://rules-wiki.invalid");
    const method = (options.method ?? "GET").toUpperCase();
    const body = options.body;
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/api/workspace/scopes")
        return operation("getWorkspaceScopes");
    if (method === "POST" && pathname === "/api/workspace/comparison")
        return operation("compareWorkspace", body);
    if (method === "GET" && pathname === "/api/global/rules/normalization/ignored-packages")
        return operation("getIgnoredNormalizationPackages");

    let match = pathname.match(/^\/api\/global\/rules\/normalization\/packages\/([^/]+)\/ignored$/);
    if (method === "PUT" && match)
        return operation("setNormalizationPackageIgnored", decodeURIComponent(match[1]), Boolean(body?.ignored));

    match = pathname.match(/^\/api\/global\/rules\/mechanical-relationships\/concepts\/([^/]+)$/);
    if (method === "GET" && match)
        return operation("getMechanicalRelationships", decodeURIComponent(match[1]));

    match = pathname.match(/^\/api\/global\/rules\/mechanical-relationships\/([^/]+)\/ruling$/);
    if (method === "PUT" && match)
        return operation("saveMechanicalRelationshipRuling", decodeURIComponent(match[1]), body);

    match = pathname.match(/^\/api\/sources\/entities\/([^/]+)\/native$/);
    if (method === "GET" && match)
        return operation("getSourceEntityNative", decodeURIComponent(match[1]));

    match = pathname.match(/^\/api\/sources\/entities\/([^/]+)$/);
    if (method === "GET" && match)
        return operation("getSourceEntity", decodeURIComponent(match[1]));

    if (method === "POST" && pathname === "/api/wiki/references/comparison")
        return operation("compareWikiReferenceVersions", body);

    if (method === "GET" && pathname === "/api/wiki/references")
        return operation("getWikiReferenceCatalog", null, queryArguments(url.searchParams));

    match = pathname.match(/^\/api\/campaigns\/([^/]+)\/wiki\/references$/);
    if (method === "GET" && match)
        return operation("getWikiReferenceCatalog", decodeURIComponent(match[1]), queryArguments(url.searchParams));

    match = pathname.match(/^\/api\/wiki\/references\/([^/]+)\/class-family$/);
    if (method === "GET" && match)
        return operation("getClassFamilyRelations", decodeURIComponent(match[1]), null);

    match = pathname.match(/^\/api\/campaigns\/([^/]+)\/wiki\/references\/([^/]+)\/class-family$/);
    if (method === "GET" && match)
        return operation("getClassFamilyRelations", decodeURIComponent(match[2]), decodeURIComponent(match[1]));

    match = pathname.match(/^\/api\/wiki\/references\/([^/]+)$/);
    if (method === "GET" && match)
        return operation("getWikiReferenceDetail", decodeURIComponent(match[1]), null);

    match = pathname.match(/^\/api\/campaigns\/([^/]+)\/wiki\/references\/([^/]+)$/);
    if (method === "GET" && match)
        return operation("getWikiReferenceDetail", decodeURIComponent(match[2]), decodeURIComponent(match[1]));

    throw new Error(`Rules Wiki browser code requested an unmapped private backend operation: ${method} ${pathname}`);
}

function operation(name, ...args) { return { operation: name, arguments: args }; }
function queryArguments(parameters) { return Object.fromEntries(parameters.entries()); }

function isAnonymousAccessError(error) {
    return error instanceof RulesCoreHttpError && (error.status === 401 || error.status === 403);
}

async function requestJson(url, options = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set("Accept", "application/json");
    const requestOptions = {
        method: options.method ?? "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers
    };
    if (Object.prototype.hasOwnProperty.call(options, "body")) {
        headers.set("Content-Type", "application/json");
        requestOptions.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get("Content-Type") ?? "";
    let payload = null;
    if (response.status !== 204) {
        if (contentType.includes("application/json") || contentType.includes("application/problem+json")) {
            payload = await response.json();
        } else {
            const text = await response.text();
            payload = text ? { detail: text } : null;
        }
    }
    if (!response.ok) {
        const message = payload?.detail ?? payload?.error ?? payload?.title ?? `Request failed with HTTP ${response.status}.`;
        throw new RulesCoreHttpError(message, response.status, payload);
    }
    return payload;
}

function trimTrailingSlash(value) { return value.endsWith("/") ? value.slice(0, -1) : value; }
