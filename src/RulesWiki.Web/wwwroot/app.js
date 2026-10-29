import { RulesCoreApi, loadToolHostContext } from "./api.js";
import { RulesAuthoringApp } from "./authoring.js";
import { installResolvedRulesBrowser } from "./rules-browser.js";
import { installImmediateReferenceBrowserLayout } from "./rules-reference-browser-layout.js";
import { installWikiReferenceApi } from "./rules-reference-api.js";
import { installWikiReferenceBrowserEnhancements, installWikiReferenceNavigation } from "./rules-reference-browser-enhancements.js";
import { installRulesCoreUx } from "./ux-shell.js";
import { alertNode, clear, describeError, element } from "./ui.js";

const root = document.getElementById("tool-root");
if (!root) throw new Error("Rules Wiki could not find the Dorks & Dice tool root.");
window.dorksAndDiceToolHost?.setContentLayout?.("full-bleed");
for (const filename of ["rules-core.css", "rules-core-detail.css", "rules-wiki-shell.css"]) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(`./${filename}`, import.meta.url).href;
    document.head.append(link);
}
clear(root);
root.append(element("div", { className: "card card-body text-body-secondary", text: "Loading Rules Wiki…" }));
try {
    const hostContext = await loadToolHostContext(root);
    const api = installWikiReferenceApi(new RulesCoreApi(hostContext));
    const session = await api.getOptionalSession();
    // The Site supplies identity; the native Core currently exposes no authoring
    // or campaign capabilities. Never infer those capabilities from Site roles.
    const app = new RulesAuthoringApp(root, api, hostContext, { ...session, globalRoles: [] }, []);
    app.nativeReferenceOnly = true;
    installResolvedRulesBrowser(app);
    installImmediateReferenceBrowserLayout(app);
    installWikiReferenceBrowserEnhancements(app);
    installRulesCoreUx(app);
    installWikiReferenceNavigation(app);
    await app.render();
} catch (error) {
    console.error("Rules Wiki failed to initialize.", error);
    clear(root);
    root.append(element("div", { className: "card card-body" },
        element("h2", { className: "h5", text: "Rules Wiki unavailable" }),
        alertNode("danger", describeError(error))));
}
