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
    if (hostContext.siteMode !== "dorks-and-dice") return;

    const toolRoute = String(hostContext.toolRoute ?? "/") || "/";
    const route = parseToolRoute(toolRoute);
    if (toolRoute !== "/" && !route.entityType && !route.conceptKey) return;

    const entityType = route.entityType ?? "";
    const viewState = parseBrowserViewState(window.location.search, entityType);
    const searchParameters = new URLSearchParams(window.location.search);
    const requestedScope = searchParameters.get("scope");
    const campaignId = requestedScope?.startsWith("campaign:")
        ? requestedScope.slice("campaign:".length).trim() || null
        : null;
    const filters = {
        entityType: entityType || null,
        query: viewState.query || null,
        sourceCode: viewState.sourceCode || null,
        overridesOnly: Boolean(campaignId && viewState.overridesOnly),
        limit: DEFAULT_PAGE_SIZE,
        offset: 0
    };

    const catalog = campaignId
        ? api.prefetchCampaignRulesCatalog(campaignId, filters)
        : api.prefetchGlobalRulesCatalog(filters);

    // A deep link already gives us the exact reference identity. Do not serialize its detail
    // request behind the catalog request; start both as soon as the Tool Host context is ready.
    if (route.conceptKey) {
        void api.prefetchWikiReferenceDetail(route.conceptKey, campaignId).catch(() => {
            // Prefetch is opportunistic. Normal browser loading retries through the regular path.
        });
    }

    void catalog.then(result => {
        if (route.conceptKey) return null;
        const predictedIdentity = !viewState.sortKey
            && !hasClientBrowserFilters(entityType, viewState.fieldFilters)
            ? result.rules?.[0]?.conceptKey
            : null;
        if (!predictedIdentity) return null;
        return api.prefetchWikiReferenceDetail(predictedIdentity, campaignId);
    }).catch(() => {
        // Prefetch is opportunistic. Normal browser loading retries through the regular path.
    });
}

function installStylesheets() {
    for (const [id, filename] of [
        ["rules-core-module-styles", "./rules-core.css"],
        ["rules-core-detail-styles", "./rules-core-detail.css"],
        ["rules-wiki-shell-styles", "./rules-wiki-shell.css"]
    ]) {
        if (document.getElementById(id)) continue;
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = new URL(filename, import.meta.url).href;
        document.head.append(link);
    }
}
