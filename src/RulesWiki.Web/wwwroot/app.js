import { RulesCoreApi, loadToolHostContext } from "./api.js";
import { installNativeReferenceApi } from "./rules-reference-api.js";
import { mountNativeRulesBrowser } from "./rules-browser.js";

const root = document.getElementById("tool-root");
if (!root) throw new Error("Rules Wiki requires the Site Tool root.");
window.dorksAndDiceToolHost?.setContentLayout?.("full-bleed");

for (const file of ["rules-core.css", "rules-wiki-shell.css", "native-browser.css"]) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = new URL(file, import.meta.url).href;
    document.head.append(style);
}
root.textContent = "Loading Rules Wiki…";
try {
    const hostContext = await loadToolHostContext(root);
    const api = installNativeReferenceApi(new RulesCoreApi(hostContext));
    await mountNativeRulesBrowser(root, api, hostContext);
} catch (error) {
    root.textContent = `Rules Wiki unavailable: ${error.message}`;
}
