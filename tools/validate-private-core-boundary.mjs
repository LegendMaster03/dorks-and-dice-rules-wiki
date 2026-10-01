import fs from "node:fs";
import path from "node:path";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const root = process.cwd();
const program = fs.readFileSync(path.join(root, "src/RulesWiki.Web/Program.cs"), "utf8");
const api = fs.readFileSync(path.join(root, "src/RulesWiki.Web/wwwroot/api.js"), "utf8");
const dispatcher = fs.readFileSync(path.join(root, "src/RulesWiki.Web/RulesCoreUiOperationDispatcher.cs"), "utf8");
const proxyPath = path.join(root, "src/RulesWiki.Web/RulesCoreDelegationProxy.cs");

assert(!fs.existsSync(proxyPath), "Rules Wiki must not retain the transparent Rules Core delegation proxy.");
assert(!program.includes('MapMethods("/api/'), "Rules Wiki must not expose a catch-all /api proxy.");
assert(!program.includes('MapGet("/api'), "Rules Wiki must not expose a general /api contract.");
assert(program.includes('/_rules-wiki/operations/{operation}'), "Rules Wiki must expose only its internal UI operation transport.");
assert(api.includes("operationBaseUrl"), "Browser traffic must use named Rules Wiki UI operations.");
assert(!api.includes("backendBaseUrl"), "Browser traffic must not target a mirrored Rules Core backend base path.");
assert(api.includes("PUBLIC_CORE_METHODS"), "Browser client must explicitly block stable public Rules Core consumer methods.");
for (const operation of ["getGlobalRulesCatalog", "getCampaignRulesCatalog", "getGlobalResolvedRule", "getCampaignResolvedRule", "getRuleVersions", "compareRuleVersions"]) {
    assert(!dispatcher.includes(`\"${operation}\" =>`), `Private operation catalog must not expose public Rules Core operation ${operation}.`);
}
console.log("Rules Wiki private Rules Core boundary guardrail passed.");
