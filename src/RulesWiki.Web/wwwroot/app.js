import { RulesCoreApi, loadToolHostContext } from "./api.js";
import { RulesAuthoringApp } from "./authoring.js";
import { installAdjudicationQueue } from "./adjudication-queue.js";
import { installCampaignBaselineAuthoring } from "./campaign-baseline-authoring.js";
import { installConceptSourceAuthoring } from "./concept-source-authoring.js";
import { installCorpusReconciliationMaintenance } from "./corpus-reconciliation-maintenance.js";
import { installHostedSourceAuthoring } from "./hosted-source-authoring.js";
import { installMechanicalRelationships } from "./mechanical-relationships.js";
import { installResolvedRulesBrowser } from "./rules-browser.js";
import { hasClientBrowserFilters } from "./rules-browser-filters.js";
import {
    parseBrowserViewState,
    parseToolRoute
} from "./rules-browser-routing.js";
import { installImmediateReferenceBrowserLayout } from "./rules-reference-browser-layout.js";
import { installWikiReferenceApi } from "./rules-reference-api.js";
import {
    installWikiReferenceBrowserEnhancements,
    installWikiReferenceNavigation
} from "./rules-reference-browser-enhancements.js";
import { installWikiReferenceCompanionContent } from "./rules-reference-companion-content.js";
import { installAdjudicationScopeControl } from "./scope-control.js";
import { installSemanticComparison } from "./semantic-comparison.js";
import { installSourceAccessAdministration } from "./source-access-admin.js";
import { installSourceAcquisitionAdministration } from "./source-acquisition-admin.js";
import { installSourceAdd } from "./source-add.js";
import { installSourceRemoval } from "./source-removal.js";
import { installSourceAdministration } from "./source-admin.js";
import { installSourceLibrary } from "./source-library.js";
import { installSourceNormalization } from "./source-normalization.js";
import { installSourceRevisionReview } from "./source-revision-review.js";
import { installSourceVersioning } from "./source-versioning.js";
import { installRulesCoreUx } from "./ux-shell.js";
import { installWorkspaceRouting } from "./workspace-routing.js";
import {
    alertNode,
    clear,
    describeError,
    element,
    DEFAULT_PAGE_SIZE
} from "./ui.js";

const root = document.getElementById("tool-root");
if (!root) throw new Error("Rules Wiki could not find the Dorks & Dice tool root.");

window.dorksAndDiceToolHost?.setContentLayout?.("full-bleed");
installStylesheets();
clear(root);
root.append(element("div", { className: "card card-body text-body-secondary", text: "Loading Rules Wiki…" }));

try {
    const hostContext = await loadToolHostContext(root);
    const api = new RulesCoreApi(hostContext);
    installWikiReferenceApi(api);
    prefetchInitialReferenceContent(api, hostContext);

    const [session, campaigns, workspaceScopes] = await Promise.all([
        api.getOptionalSession(),
        api.getOptionalCampaigns(),
        api.backend("/api/workspace/scopes")
    ]);
    const effectiveSession = session ?? {
        user: null,
        globalRoles: []
    };

    // Existing Rules Wiki feature modules consume canEditGlobal through the session-shaped
    // Rules Lawyer flag. Derive that compatibility flag from Rules Core's authoritative workspace
    // capability rather than from the Site's global-role list, because Rules Lawyer is mode-scoped.
    const globalRoles = (effectiveSession.globalRoles ?? [])
        .filter(role => role !== "Rules Lawyer");
    const canAdjudicateGlobal = Array.isArray(workspaceScopes?.scopes)
        && workspaceScopes.scopes.some(scope => scope.kind === "global" && scope.canAdjudicate === true);
    if (canAdjudicateGlobal) globalRoles.push("Rules Lawyer");
    effectiveSession.globalRoles = globalRoles;

    const app = new RulesAuthoringApp(root, api, hostContext, effectiveSession, campaigns);
    installResolvedRulesBrowser(app);
    installImmediateReferenceBrowserLayout(app);
    installWikiReferenceBrowserEnhancements(app);
    installWikiReferenceCompanionContent(app);
    installAdjudicationScopeControl(app);
    installSemanticComparison(app);
    installMechanicalRelationships(app);
    installConceptSourceAuthoring(app);
    installSourceNormalization(app);
    installSourceRevisionReview(app);
    installSourceVersioning(app);
    installAdjudicationQueue(app);
    installHostedSourceAuthoring(app);
    installSourceAdministration(app);
    installCorpusReconciliationMaintenance(app);
    installSourceAccessAdministration(app);
    installSourceAcquisitionAdministration(app);
    installCampaignBaselineAuthoring(app);
    if (hostContext.siteMode === "dorks-and-dice") {
        installSourceLibrary(app);
        installSourceAdd(app);
        installSourceRemoval(app);
    }
    installWorkspaceRouting(app);
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

function prefetchInitialReferenceContent(api, hostContext) {
    const route = parseToolRoute(window.location.pathname, window.location.search, hostContext.basePath);
    if (route.view === "rules") {
        const state = parseBrowserViewState(route.pathSegments, route.searchParams);
        if (state.referenceIdentity && state.referenceView === "detail") {
            api.prefetchWikiReferenceDetail?.(state.referenceIdentity, null);
        } else if (!state.referenceIdentity && !hasClientBrowserFilters(state.filters)) {
            api.prefetchWikiReferenceCatalog?.(null, state.filters, DEFAULT_PAGE_SIZE, 0);
        }
    }
}

function installStylesheets() {
    for (const href of ["/css/bootstrap.min.css", "/css/tool-ui.css"]) {
        if (document.querySelector(`link[data-rules-core-stylesheet="${href}"]`)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.dataset.rulesCoreStylesheet = href;
        document.head.append(link);
    }
}
