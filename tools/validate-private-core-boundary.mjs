import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function collectRuntimeSources(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectRuntimeSources(fullPath));
            continue;
        }
        if (entry.isFile() && (entry.name.endsWith(".cs") || entry.name.endsWith(".js"))) {
            files.push(fullPath);
        }
    }
    return files;
}

const root = process.cwd();
const webRoot = path.join(root, "src/RulesWiki.Web");
const program = fs.readFileSync(path.join(webRoot, "Program.cs"), "utf8");
const api = fs.readFileSync(path.join(webRoot, "wwwroot/api.js"), "utf8");
const dispatcher = fs.readFileSync(path.join(webRoot, "RulesCoreUiOperationDispatcher.cs"), "utf8");
const privateClient = fs.readFileSync(path.join(webRoot, "RulesCorePrivateClient.cs"), "utf8");
const proxyPath = path.join(webRoot, "RulesCoreDelegationProxy.cs");
const runtimeSource = collectRuntimeSources(webRoot)
    .map(file => fs.readFileSync(file, "utf8"))
    .join("\n");

assert(!fs.existsSync(proxyPath), "Rules Wiki must not retain the transparent Rules Core delegation proxy.");
assert(!program.includes('MapMethods("/api/'), "Rules Wiki must not expose a catch-all /api proxy.");
assert(!program.includes('MapGet("/api'), "Rules Wiki must not expose a general /api contract.");
assert(program.includes('/_rules-wiki/operations/{operation}'), "Rules Wiki must expose only its internal UI operation transport.");
assert(program.includes('RulesCorePrivate:BaseUrl'), "Rules Wiki must require a deployment-provided private Rules Core base URL.");
assert(api.includes("operationBaseUrl"), "Browser traffic must use named Rules Wiki UI operations.");
assert(!api.includes("backendBaseUrl"), "Browser traffic must not target a mirrored Rules Core backend base path.");
assert(api.includes("PUBLIC_CORE_METHODS"), "Browser client must explicitly block stable public Rules Core consumer methods.");
assert(privateClient.includes("/api/private-tunnel/rules-core/ticket"), "Rules Wiki must exchange its private-tunnel capability for a Rules Core target ticket.");
assert(privateClient.includes("RulesCorePrivateClient.RulesCoreClientName") || privateClient.includes("CreateClient(RulesCoreClientName)"), "Rules Wiki must send Core data traffic through the private Rules Core client.");

for (const forbidden of [
    "RulesCoreDelegationProxy",
    "DelegationCapability",
    "DelegationPath",
    "/api/delegate/",
    "X-Dorks-Tool-Delegation"
]) {
    assert(!runtimeSource.includes(forbidden), `Rules Wiki runtime source must not reintroduce ordinary Site delegation for private Core access: ${forbidden}`);
}

for (const operation of ["getGlobalRulesCatalog", "getCampaignRulesCatalog", "getGlobalResolvedRule", "getCampaignResolvedRule", "getRuleVersions", "compareRuleVersions"]) {
    assert(!dispatcher.includes(`\"${operation}\" =>`), `Private operation catalog must not expose public Rules Core operation ${operation}.`);
}

console.log("Rules Wiki private Rules Core boundary guardrail passed.");
