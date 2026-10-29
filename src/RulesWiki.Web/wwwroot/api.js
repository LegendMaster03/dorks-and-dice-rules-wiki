export class RulesCoreHttpError extends Error {
    constructor(message, status, details = null) {
        super(message);
        this.name = "RulesCoreHttpError";
        this.status = status;
        this.details = details;
    }
}

export async function loadToolHostContext(root) {
    const url = root.dataset.toolContextUrl;
    if (!url) throw new Error("The Site Tool Host context is required.");
    return requestJson(url);
}

export class RulesCoreApi {
    constructor(hostContext) {
        if (!hostContext?.apiBaseUrl) throw new Error("The Tool Host API base URL is missing.");
        this.hostContext = hostContext;
        this.operationBaseUrl = `${hostContext.apiBaseUrl.replace(/\/$/, "")}/upstream/_rules-wiki/operations`;
    }

    getOptionalSession() {
        return requestJson(`${this.hostContext.apiBaseUrl.replace(/\/$/, "")}/session`);
    }

    operation(name, args = []) {
        if (!["getNativeRulesets", "searchNativeRules", "getNativeRule"].includes(name)) {
            throw new Error("This operation is unavailable in the read-only native Wiki.");
        }
        return requestJson(`${this.operationBaseUrl}/${name}`, {
            method: "POST",
            body: { arguments: args }
        });
    }
}

async function requestJson(url, options = {}) {
    const headers = new Headers({ Accept: "application/json" });
    const config = { method: options.method ?? "GET", credentials: "same-origin", cache: "no-store", headers };
    if (Object.hasOwn(options, "body")) {
        headers.set("Content-Type", "application/json");
        config.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, config);
    const contentType = response.headers.get("Content-Type") ?? "";
    const payload = contentType.includes("json") ? await response.json() : null;
    if (!response.ok) {
        throw new RulesCoreHttpError(payload?.error ?? `HTTP ${response.status}`, response.status, payload);
    }
    return payload;
}
