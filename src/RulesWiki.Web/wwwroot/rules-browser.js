import {
    clear,
    describeError,
    element,
    formatDate,
    DEFAULT_PAGE_SIZE
} from "./ui.js";
import { renderRuleDetailPane } from "./rules-browser-detail.js";
import {
    catalogRouteForEntity,
    currentToolRoute,
    parseBrowserScopeFromLocation,
    parseBrowserViewStateFromLocation,
    parseToolRoute,
    pushToolRoute,
    replaceToolRoute
} from "./rules-browser-routing.js";
import {
    RULE_FAMILY_TABS,
    canSortBrowserDataset,
    libraryTitle,
    normalizeBrowserSort,
    renderContinuousIndexFooter,
    renderIndexHeader,
    renderRuleRows,
    sortRulesForBrowser
} from "./rules-browser-index.js";
import {
    getBrowserFilterDefinitions,
    getKnownEntityBrowserConfigs
} from "./rules-browser-config.js";
import {
    browserFilterOptions,
    countActiveBrowserFilters,
    filterRulesForBrowser,
    hasClientBrowserFilters,
    normalizeBrowserFieldFilters
} from "./rules-browser-filters.js";

export { RULE_FAMILY_TABS } from "./rules-browser-index.js";

const DORKS_MODE = "dorks-and-dice";
const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const COMPACT_BROWSER_WIDTH = 900;

export function installResolvedRulesBrowser(app) {
    installReferenceBrowserStylesheet();
    app.canBrowseRules = app.hostContext.siteMode === DORKS_MODE;
    app.browserScope = "global";
    app.browserPage = 0;
    app.browserFilters = {
        entityType: "",
        query: "",
        sourceCode: "",
        overridesOnly: false,
        fieldFilters: {}
    };
    app.browserSort = { key: null, direction: "asc" };
    app.browserDeepLink = null;
    app.browserSelectedConceptKey = null;

    const routeScope = parseBrowserScopeFromLocation(app);
    if (routeScope) app.browserScope = routeScope;

    const route = parseToolRoute(app.hostContext.toolRoute);
    app.browserRouteRequested = Boolean(route.entityType || route.conceptKey);
    if (route.entityType) app.browserFilters.entityType = route.entityType;
    const routeViewState = parseBrowserViewStateFromLocation(app.browserFilters.entityType);
    app.browserFilters.query = routeViewState.query;
    app.browserFilters.sourceCode = routeViewState.sourceCode;
    app.browserFilters.overridesOnly = routeViewState.overridesOnly;
    app.browserFilters.fieldFilters = routeViewState.fieldFilters;
    app.browserSort = normalizeBrowserSort(app.browserFilters.entityType, {
        key: routeViewState.sortKey,
        direction: routeViewState.sortDirection
    });
    if (route.conceptKey) {
        app.browserDeepLink = route.conceptKey;
        app.browserSelectedConceptKey = route.conceptKey;
    }

    if (app.canBrowseRules) app.activeView = "library";

    app.ruleFamilyTabs = RULE_FAMILY_TABS;
    app.navigateRuleFamily = async entityType => {
        const nextEntityType = entityType ?? "";
        app.browserDeepLink = null;
        app.browserSelectedConceptKey = null;
        app.libraryDeepLink = null;
        app.libraryRouteActive = false;
        app.browserFilters.entityType = nextEntityType;
        app.browserFilters.fieldFilters = {};
        app.browserSort = normalizeBrowserSort(nextEntityType, app.browserSort);
        app.activeView = "library";
        pushToolRoute(app, catalogRouteForEntity(nextEntityType), app.browserScope);
        await app.render();
    };

    app.browserKeyboard ??= {
        focusSearch: null,
        selectRelative: null,
        returnToList: null
    };
    if (!app.browserKeyboardBound) {
        app.browserKeyboardBound = true;
        window.addEventListener("keydown", event => {
            if (app.activeView !== "library" || event.altKey || event.ctrlKey || event.metaKey) return;

            const key = String(event.key ?? "").toLowerCase();
            if (key === "escape" && app.browserKeyboard.returnToList?.()) {
                event.preventDefault();
                return;
            }

            const targetIsResultRow = event.target instanceof Element
                && Boolean(event.target.closest(".rules-core-library-row"));
            if (isEditableTarget(event.target) && !targetIsResultRow) return;

            if (key === "j" || key === "arrowdown") {
                event.preventDefault();
                app.browserKeyboard.selectRelative?.(1);
                return;
            }
            if (key === "k" || key === "arrowup") {
                event.preventDefault();
                app.browserKeyboard.selectRelative?.(-1);
                return;
            }
            if (key === "f" || key === "/") {
                event.preventDefault();
                app.browserKeyboard.focusSearch?.();
            }
        });
    }

    app.viewNavigation ??= {};
    app.viewNavigation.library = async () =>
        app.navigateRuleFamily(app.browserFilters.entityType);

    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        if (app.activeView === "library") {
            await renderRulesBrowser(app, container);
            return;
        }
        await renderActiveView(container);
    };

    window.addEventListener("popstate", async () => {
        if (!app.canBrowseRules) return;

        const toolRoute = currentToolRoute(app);
        if (toolRoute === "/sources" || toolRoute.startsWith("/sources/")) return;

        const next = parseToolRoute(toolRoute);
        const nextEntityType = next.entityType ?? "";
        const nextViewState = parseBrowserViewStateFromLocation(nextEntityType);
        app.browserScope = parseBrowserScopeFromLocation(app) ?? "global";
        app.browserFilters.entityType = nextEntityType;
        app.browserFilters.query = nextViewState.query;
        app.browserFilters.sourceCode = nextViewState.sourceCode;
        app.browserFilters.overridesOnly = nextViewState.overridesOnly;
        app.browserFilters.fieldFilters = nextViewState.fieldFilters;
        app.browserSort = normalizeBrowserSort(nextEntityType, {
            key: nextViewState.sortKey,
            direction: nextViewState.sortDirection
        });
        app.browserDeepLink = next.conceptKey ?? null;
        app.browserSelectedConceptKey = next.conceptKey ?? null;
        app.activeView = "library";
        await app.render();
    });
}

async function renderRulesBrowser(app, container) {
    clear(container);

    const shell = element("section", { className: "rules-core-library-shell" });
    const headingTitle = element("h2", {
        className: "rules-core-library-title",
        text: libraryTitle(app.browserFilters.entityType)
    });
    const revision = element("div", {
        className: "rules-core-library-revision",
        text: "Loading published rules…"
    });
    const heading = element("div", { className: "rules-core-library-heading" },
        headingTitle,
        revision);

    const controls = element("div", { className: "rules-core-library-controls" });
    const scope = element("select", {
        className: "form-select form-select-sm rules-core-library-scope",
        ariaLabel: "Rules scope"
    });
    scope.append(element("option", { value: "global", text: "Dorks & Dice" }));
    for (const campaign of app.campaigns) {
        scope.append(element("option", {
            value: `campaign:${campaign.id}`,
            text: campaign.name ?? `Campaign ${campaign.id}`
        }));
    }
    scope.value = app.browserScope;

    const knownEntityTypes = new Set(
        getKnownEntityBrowserConfigs().map(configuration => configuration.entityType));
    const moreTypes = element("select", {
        className: "form-select form-select-sm rules-core-library-more-types",
        ariaLabel: "More rule types",
        attributes: { hidden: "" }
    });

    const populateEntityTypeFacets = facets => {
        const currentEntityType = app.browserFilters.entityType ?? "";
        const dynamicTypes = [];
        for (const facet of facets ?? []) {
            if (!facet.entityType || knownEntityTypes.has(facet.entityType)) continue;
            if (dynamicTypes.some(value => value.entityType === facet.entityType)) continue;
            dynamicTypes.push(facet);
        }

        if (currentEntityType
            && !knownEntityTypes.has(currentEntityType)
            && !dynamicTypes.some(value => value.entityType === currentEntityType)) {
            dynamicTypes.unshift({ entityType: currentEntityType, count: null });
        }

        moreTypes.replaceChildren(element("option", {
            value: "",
            text: dynamicTypes.length ? "More rule types…" : "No additional rule types"
        }));
        for (const facet of dynamicTypes) {
            moreTypes.append(element("option", {
                value: facet.entityType,
                text: facet.count === null || facet.count === undefined
                    ? pluralizeEntityType(facet.entityType)
                    : `${pluralizeEntityType(facet.entityType)} (${facet.count})`
            }));
        }

        moreTypes.hidden = dynamicTypes.length === 0;
        moreTypes.value = currentEntityType && !knownEntityTypes.has(currentEntityType)
            ? currentEntityType
            : "";
    };

    controls.append(scope, moreTypes);

    const search = element("input", {
        className: "form-control form-control-sm rules-core-library-search",
        type: "search",
        value: app.browserFilters.query,
        placeholder: `Search ${libraryTitle(app.browserFilters.entityType).toLowerCase()}…`,
        ariaLabel: "Search rules",
        title: "Press F or / to focus search. Use J/K to move through results."
    });
    const searchField = element("div", { className: "rules-core-library-search-field" },
        search,
        element("span", {
            className: "rules-core-library-search-hint",
            text: "F",
            attributes: { "aria-hidden": "true" }
        }));
    const clearSearch = element("button", {
        type: "button",
        className: "rules-core-library-search-clear",
        text: "×",
        ariaLabel: "Clear search",
        title: "Clear search",
        disabled: !search.value
    });
    const filterToggle = element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-secondary rules-core-library-filter-toggle",
        text: "Filters",
        attributes: { "aria-expanded": "false" }
    });
    const indexStatus = element("span", {
        className: "rules-core-library-search-status",
        text: "Loading…",
        attributes: { "aria-live": "polite" }
    });
    const searchGroup = element("div", { className: "rules-core-library-search-group" },
        element("div", { className: "rules-core-library-search-wrap" },
            searchField,
            clearSearch),
        indexStatus,
        filterToggle);

    const routedSourceCode = app.browserFilters.sourceCode ?? "";
    const sourceFilter = element("select", {
        className: "form-select form-select-sm",
        ariaLabel: "Filter by source"
    },
    element("option", { value: "", text: "All sources" }),
    routedSourceCode
        ? element("option", { value: routedSourceCode, text: routedSourceCode })
        : null);
    sourceFilter.value = routedSourceCode;
    const overrideInput = element("input", {
        type: "checkbox",
        className: "form-check-input"
    });
    overrideInput.checked = Boolean(app.browserFilters.overridesOnly);
    const overrideFilter = element("label", {
        className: "rules-core-library-filter-check"
    }, overrideInput, element("span", { text: "Campaign overrides only" }));
    const dynamicFilterFields = element("div", {
        className: "rules-core-library-filter-fields"
    });
    const filterAvailability = element("p", {
        className: "rules-core-library-filter-note",
        attributes: { hidden: "" }
    });
    const clearFilters = element("button", {
        type: "button",
        className: "btn btn-sm btn-link rules-core-library-filter-clear",
        text: "Clear filters"
    });
    const filterBar = element("div", {
        className: "rules-core-library-filterbar",
        attributes: { hidden: "" }
    },
    element("label", { className: "rules-core-library-filter-field" },
        element("span", { text: "Source" }),
        sourceFilter),
    overrideFilter,
    dynamicFilterFields,
    filterAvailability,
    clearFilters);

    const workspace = element("div", { className: "rules-core-library-workspace" });
    const index = element("section", {
        className: "rules-core-library-index",
        ariaLabel: "Rules index"
    });
    const indexHeader = element("div", { className: "rules-core-library-index-header" });
    const list = element("div", {
        className: "rules-core-library-index-list",
        role: "listbox",
        ariaLabel: "Published rules"
    });
    const indexFooter = element("div", { className: "rules-core-library-index-footer" });
    index.append(searchGroup, filterBar, indexHeader, list, indexFooter);

    const detail = element("section", {
        className: "rules-core-library-detail",
        ariaLabel: "Selected rule",
        attributes: { tabindex: "-1" }
    });
    detail.append(renderEmptyDetail("Select a rule from the list."));

    workspace.append(index, detail);
    shell.append(heading, controls, workspace);
    container.append(shell);

    let loadSerial = 0;
    let detailSerial = 0;
    let rowByConceptKey = new Map();
    let currentRules = [];
    let totalCount = 0;
    let hasMore = false;
    let hasPublishedRuleset = false;
    let isLoadingMore = false;
    let loadMoreError = null;
    let searchTimer = null;
    let preserveDeepLink = Boolean(app.browserDeepLink);
    let loadMore = async () => [];

    const hasCompleteDataset = () =>
        hasPublishedRuleset
        && canSortBrowserDataset(currentRules.length, totalCount);

    const canSortCurrentDataset = () =>
        hasCompleteDataset() && currentRules.length > 0;

    const currentDisplayRules = () => {
        const filtered = hasCompleteDataset()
            ? filterRulesForBrowser(
                currentRules,
                app.browserFilters.entityType,
                app.browserFilters.fieldFilters)
            : [...currentRules];
        return canSortCurrentDataset()
            ? sortRulesForBrowser(filtered, app.browserFilters.entityType, app.browserSort)
            : filtered;
    };

    const syncSelectedRowState = conceptKey => {
        for (const [key, row] of rowByConceptKey) {
            const selected = key === conceptKey;
            row.classList.toggle("is-selected", selected);
            row.setAttribute("aria-selected", selected ? "true" : "false");
        }
    };

    const selectRule = async rule => {
        if (!rule) return;
        preserveDeepLink = false;
        pushToolRoute(app, rule.browserLink?.toolRelativePath);
        await renderSelection(rule.conceptKey);
    };

    const rebuildRowMap = () => {
        rowByConceptKey = new Map(
            Array.from(list.querySelectorAll("[data-concept-key]"))
                .map(row => [row.dataset.conceptKey, row]));
        syncSelectedRowState(app.browserSelectedConceptKey);
    };

    const renderCurrentRows = ({ focusSelection = false } = {}) => {
        renderRuleRows(
            list,
            currentDisplayRules(),
            app.browserFilters.entityType,
            selectRule);
        rebuildRowMap();
        if (focusSelection) {
            rowByConceptKey.get(app.browserSelectedConceptKey)?.focus?.({ preventScroll: true });
        }
    };

    const refreshIndexHeader = () => {
        renderIndexHeader(
            indexHeader,
            app.browserFilters.entityType,
            app.browserSort,
            nextSort => {
                app.browserSort = normalizeBrowserSort(app.browserFilters.entityType, nextSort);
                pushToolRoute(app, currentToolRoute(app), app.browserScope);
                renderCurrentRows({ focusSelection: true });
                refreshIndexHeader();
                refreshListState();
            },
            { canSort: canSortCurrentDataset() });
    };

    const syncFilterControls = () => {
        const campaignScope = scope.value.startsWith("campaign:");
        overrideFilter.hidden = !campaignScope;
        if (!campaignScope) {
            overrideInput.checked = false;
            app.browserFilters.overridesOnly = false;
        }

        const activeCount = countActiveBrowserFilters(app.browserFilters.entityType, {
            sourceCode: sourceFilter.value,
            overridesOnly: campaignScope && overrideInput.checked,
            fieldFilters: app.browserFilters.fieldFilters
        });
        filterToggle.textContent = activeCount ? `Filters (${activeCount})` : "Filters";
        filterToggle.classList.toggle("is-active", activeCount > 0);
        clearSearch.disabled = !search.value;
    };

    const populateSourceFacets = facets => {
        const selected = app.browserFilters.sourceCode ?? sourceFilter.value;
        sourceFilter.replaceChildren(element("option", {
            value: "",
            text: "All sources"
        }));
        for (const facet of facets ?? []) {
            sourceFilter.append(element("option", {
                value: facet.sourceCode,
                text: `${facet.sourceCode} (${facet.count})`
            }));
        }
        const selectedExists = Array.from(sourceFilter.options)
            .some(option => option.value === selected);
        if (selected && !selectedExists) {
            sourceFilter.append(element("option", {
                value: selected,
                text: `${selected} (0)`
            }));
        }
        sourceFilter.value = selected;
        syncFilterControls();
    };

    const renderConfiguredFilters = () => {
        dynamicFilterFields.replaceChildren();
        const definitions = getBrowserFilterDefinitions(app.browserFilters.entityType)
            .filter(definition => definition.mode === "client-complete");
        const complete = hasCompleteDataset();
        const normalized = normalizeBrowserFieldFilters(
            app.browserFilters.entityType,
            app.browserFilters.fieldFilters);
        app.browserFilters.fieldFilters = normalized;

        for (const definition of definitions) {
            const select = element("select", {
                className: "form-select form-select-sm",
                ariaLabel: `Filter by ${definition.label.toLowerCase()}`,
                disabled: !complete
            });
            select.append(element("option", {
                value: "",
                text: complete ? `All ${definition.label.toLowerCase()}` : "Load all results to filter"
            }));
            if (complete) {
                for (const value of browserFilterOptions(currentRules, definition)) {
                    select.append(element("option", { value, text: value }));
                }
            }
            select.value = normalized[definition.key] ?? "";
            select.addEventListener("change", () => {
                const next = { ...app.browserFilters.fieldFilters };
                if (select.value) next[definition.key] = select.value;
                else delete next[definition.key];
                app.browserFilters.fieldFilters = normalizeBrowserFieldFilters(
                    app.browserFilters.entityType,
                    next);
                replaceToolRoute(app, currentToolRoute(app), app.browserScope);
                renderCurrentRows();
                syncFilterControls();
                refreshListState();
            });
            dynamicFilterFields.append(element("label", {
                className: "rules-core-library-filter-field"
            }, element("span", { text: definition.label }), select));
        }

        const unavailable = definitions.length > 0 && !complete;
        filterAvailability.hidden = !unavailable;
        filterAvailability.textContent = unavailable
            ? "Type-specific and edition filters become available after the complete result set is loaded."
            : "";
        syncFilterControls();
    };

    app.browserKeyboard.focusSearch = () => {
        search.focus();
        search.select();
    };
    app.browserKeyboard.selectRelative = async direction => {
        const displayRules = currentDisplayRules();
        if (!displayRules.length) return;

        const currentIndex = displayRules.findIndex(rule =>
            rule.conceptKey === app.browserSelectedConceptKey);
        if (direction > 0 && currentIndex === displayRules.length - 1 && hasMore) {
            const added = await loadMore();
            if (added.length) {
                const nextRules = currentDisplayRules();
                const rule = nextRules[Math.min(currentIndex + 1, nextRules.length - 1)];
                if (rule) {
                    await selectRule(rule);
                    const row = rowByConceptKey.get(rule.conceptKey);
                    row?.scrollIntoView?.({ block: "nearest" });
                    row?.focus?.({ preventScroll: true });
                }
            }
            return;
        }

        const startIndex = currentIndex >= 0
            ? currentIndex
            : direction > 0 ? -1 : 0;
        const nextIndex = Math.max(
            0,
            Math.min(displayRules.length - 1, startIndex + direction));
        const rule = displayRules[nextIndex];
        if (!rule || rule.conceptKey === app.browserSelectedConceptKey) return;
        await selectRule(rule);
        const row = rowByConceptKey.get(rule.conceptKey);
        row?.scrollIntoView?.({ block: "nearest" });
        row?.focus?.({ preventScroll: true });
    };

    const showIndexOnCompactViewport = () => {
        if (!isCompactLibraryViewport(shell)) return false;
        workspace.classList.remove("has-selection");
        pushToolRoute(app, catalogRouteForEntity(app.browserFilters.entityType), app.browserScope);
        const selectedRow = rowByConceptKey.get(app.browserSelectedConceptKey);
        if (selectedRow) {
            selectedRow.scrollIntoView?.({ block: "nearest" });
            selectedRow.focus?.({ preventScroll: true });
        } else {
            search.focus?.({ preventScroll: true });
        }
        return true;
    };
    app.browserKeyboard.returnToList = showIndexOnCompactViewport;

    const renderSelection = async conceptKey => {
        const serial = ++detailSerial;
        app.browserSelectedConceptKey = conceptKey;
        workspace.classList.add("has-selection");
        syncSelectedRowState(conceptKey);
        await renderRuleDetailPane(
            app,
            detail,
            conceptKey,
            app.browserScope,
            serial,
            () => detailSerial,
            showIndexOnCompactViewport);

        if (isCompactLibraryViewport(shell) && serial === detailSerial) {
            detail.focus({ preventScroll: true });
            detail.scrollIntoView({ block: "start" });
        }
    };

    const refreshListState = () => {
        const displayedCount = currentDisplayRules().length;
        const clientFiltered = hasCompleteDataset()
            && hasClientBrowserFilters(
                app.browserFilters.entityType,
                app.browserFilters.fieldFilters);
        if (!hasPublishedRuleset) {
            indexStatus.textContent = "Nothing published";
        } else if (hasMore) {
            indexStatus.textContent = `${currentRules.length} of ${totalCount} · load all to sort/filter`;
        } else if (clientFiltered) {
            indexStatus.textContent = `${displayedCount} matching · ${totalCount} total`;
        } else {
            indexStatus.textContent = `${currentRules.length} of ${totalCount}`;
        }
        renderContinuousIndexFooter(
            indexFooter,
            currentRules.length,
            totalCount,
            hasMore,
            isLoadingMore,
            loadMoreError,
            () => void loadMore());
        refreshIndexHeader();
        renderConfiguredFilters();
    };

    loadMore = async () => {
        if (!hasMore || isLoadingMore) return [];
        const serial = loadSerial;
        isLoadingMore = true;
        loadMoreError = null;
        refreshListState();

        try {
            const offset = currentRules.length;
            const filters = {
                entityType: app.browserFilters.entityType || null,
                query: app.browserFilters.query || null,
                sourceCode: app.browserFilters.sourceCode || null,
                overridesOnly: app.browserFilters.overridesOnly,
                limit: PAGE_SIZE,
                offset
            };
            const requested = app.browserScope === "global"
                ? await app.api.getGlobalRulesCatalog(filters)
                : await app.api.getCampaignRulesCatalog(
                    app.browserScope.slice("campaign:".length),
                    filters);
            if (serial !== loadSerial) return [];

            const added = requested.rules ?? [];
            if (!added.length) {
                hasMore = false;
                return [];
            }

            currentRules.push(...added);
            totalCount = requested.totalCount ?? totalCount;
            hasMore = currentRules.length < totalCount;

            if (hasCompleteDataset() || app.browserSort.key
                || hasClientBrowserFilters(
                    app.browserFilters.entityType,
                    app.browserFilters.fieldFilters)) {
                renderCurrentRows();
            } else {
                renderRuleRows(
                    list,
                    added,
                    app.browserFilters.entityType,
                    selectRule,
                    { append: true });
                rebuildRowMap();
            }
            return added;
        } catch (error) {
            if (serial === loadSerial) loadMoreError = describeError(error);
            return [];
        } finally {
            if (serial === loadSerial) {
                isLoadingMore = false;
                refreshListState();
            }
        }
    };

    const loadCompleteDatasetForActiveClientFilters = async serial => {
        if (!hasClientBrowserFilters(
            app.browserFilters.entityType,
            app.browserFilters.fieldFilters)) return;
        while (hasMore && serial === loadSerial) {
            const before = currentRules.length;
            await loadMore();
            if (loadMoreError || currentRules.length === before) break;
        }
    };

    const load = async ({ keepSelection = false } = {}) => {
        const serial = ++loadSerial;
        app.browserPage = 0;
        isLoadingMore = false;
        currentRules = [];
        totalCount = 0;
        hasMore = false;
        hasPublishedRuleset = false;
        loadMoreError = null;

        app.browserScope = scope.value;
        app.browserFilters = {
            entityType: app.browserFilters.entityType ?? "",
            query: search.value.trim(),
            sourceCode: sourceFilter.value,
            overridesOnly: scope.value.startsWith("campaign:") && overrideInput.checked,
            fieldFilters: normalizeBrowserFieldFilters(
                app.browserFilters.entityType,
                app.browserFilters.fieldFilters)
        };
        app.browserSort = normalizeBrowserSort(app.browserFilters.entityType, app.browserSort);
        syncFilterControls();

        list.replaceChildren(renderIndexState("Loading rules…", "Searching the published reference."));
        indexFooter.replaceChildren();
        refreshIndexHeader();
        renderConfiguredFilters();

        try {
            const filters = {
                entityType: app.browserFilters.entityType || null,
                query: app.browserFilters.query || null,
                sourceCode: app.browserFilters.sourceCode || null,
                overridesOnly: app.browserFilters.overridesOnly,
                limit: PAGE_SIZE,
                offset: 0
            };
            const requested = app.browserScope === "global"
                ? await app.api.getGlobalRulesCatalog(filters)
                : await app.api.getCampaignRulesCatalog(
                    app.browserScope.slice("campaign:".length),
                    filters);
            if (serial !== loadSerial) return;

            populateEntityTypeFacets(requested.entityTypeFacets);
            populateSourceFacets(requested.sourceFacets);
            const rules = requested.rules ?? [];
            currentRules = [...rules];
            totalCount = requested.totalCount ?? rules.length;
            hasPublishedRuleset = Boolean(requested.revisionNumber);
            hasMore = hasPublishedRuleset && currentRules.length < totalCount;

            revision.textContent = requested.revisionNumber
                ? `${scopeLabel(app, app.browserScope)} · Published #${requested.revisionNumber} · ${formatDate(requested.publishedAt)}`
                : `${scopeLabel(app, app.browserScope)} · Nothing published`;

            await loadCompleteDatasetForActiveClientFilters(serial);
            if (serial !== loadSerial) return;
            renderCurrentRows();
            refreshListState();

            if (!requested.revisionNumber) {
                const message = app.browserScope === "global"
                    ? "No Dorks & Dice rules have been published yet."
                    : "No rules have been published for this campaign yet.";
                list.replaceChildren(renderIndexState(message, "Published rules will appear here when they are available."));
                app.browserSelectedConceptKey = null;
                workspace.classList.remove("has-selection");
                detail.replaceChildren(renderEmptyDetail(message));
                return;
            }

            if (!rules.length) {
                const emptyState = await resolvePublishedEmptyState(app);
                if (serial !== loadSerial) return;
                list.replaceChildren(renderIndexState(
                    emptyState.message,
                    emptyState.note,
                    emptyState.showSourceLibrary ? renderSourceLibraryAction(app) : null));

                if (keepSelection && app.browserSelectedConceptKey) {
                    const remainsAvailable = await isRuleAvailableInScope(
                        app,
                        app.browserSelectedConceptKey,
                        app.browserScope);
                    if (serial !== loadSerial) return;
                    if (remainsAvailable) {
                        await renderSelection(app.browserSelectedConceptKey);
                        return;
                    }
                }

                app.browserSelectedConceptKey = null;
                workspace.classList.remove("has-selection");
                detail.replaceChildren(renderEmptyDetail(
                    emptyState.message,
                    emptyState.showSourceLibrary ? renderSourceLibraryAction(app) : null,
                    emptyState.note));
                return;
            }

            if (hasCompleteDataset() && currentDisplayRules().length === 0) {
                list.replaceChildren(renderIndexState(
                    `No published ${pluralizeEntityType(app.browserFilters.entityType).toLowerCase()} match the current filters.`,
                    "Clear or change the filters to inspect other published rules in this scope."));
            }

            let conceptKey = keepSelection ? app.browserSelectedConceptKey : null;
            const deepLinkedConceptKey = preserveDeepLink && app.browserDeepLink
                ? app.browserDeepLink
                : null;
            if (deepLinkedConceptKey) {
                conceptKey = deepLinkedConceptKey;
                app.browserDeepLink = null;
            } else if (conceptKey && keepSelection
                && !currentRules.some(rule => rule.conceptKey === conceptKey)) {
                const remainsAvailable = await isRuleAvailableInScope(
                    app,
                    conceptKey,
                    app.browserScope);
                if (serial !== loadSerial) return;
                if (!remainsAvailable) {
                    conceptKey = isCompactLibraryViewport(shell) ? null : currentDisplayRules()[0]?.conceptKey;
                    app.browserSelectedConceptKey = conceptKey;
                    pushToolRoute(
                        app,
                        catalogRouteForEntity(app.browserFilters.entityType),
                        app.browserScope);
                }
            } else if (!conceptKey) {
                conceptKey = isCompactLibraryViewport(shell) ? null : currentDisplayRules()[0]?.conceptKey;
            }

            if (conceptKey) {
                await renderSelection(conceptKey);
            } else {
                workspace.classList.remove("has-selection");
                detail.replaceChildren(renderEmptyDetail("Select a rule from the list."));
            }
        } catch (error) {
            if (serial !== loadSerial) return;
            loadMoreError = null;
            list.replaceChildren(renderIndexError(error, () => void load({ keepSelection: true })));
            indexFooter.replaceChildren();
            indexStatus.textContent = "Load failed";
            if (!app.browserSelectedConceptKey) {
                detail.replaceChildren(renderEmptyDetail("The rule list could not be loaded."));
            }
        }
    };

    list.addEventListener("scroll", () => {
        if (!hasMore || isLoadingMore) return;
        const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
        if (remaining <= 180) void loadMore();
    });

    scope.addEventListener("change", async () => {
        detailSerial += 1;
        if (!scope.value.startsWith("campaign:")) overrideInput.checked = false;
        app.browserScope = scope.value;
        app.browserFilters.overridesOnly = scope.value.startsWith("campaign:") && overrideInput.checked;
        pushToolRoute(app, currentToolRoute(app), app.browserScope);
        syncFilterControls();
        await load({ keepSelection: true });
    });

    const changeEntityType = async value => {
        if (app.browserFilters.entityType === value) return;
        preserveDeepLink = false;
        app.browserSelectedConceptKey = null;
        await app.navigateRuleFamily(value);
    };

    moreTypes.addEventListener("change", () => {
        if (!moreTypes.value) return;
        void changeEntityType(moreTypes.value);
    });

    clearSearch.addEventListener("click", async () => {
        if (!search.value) return;
        preserveDeepLink = false;
        if (searchTimer) clearTimeout(searchTimer);
        search.value = "";
        app.browserFilters.query = "";
        clearSearch.disabled = true;
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        await load({ keepSelection: true });
        search.focus();
    });

    filterToggle.addEventListener("click", () => {
        filterBar.hidden = !filterBar.hidden;
        filterToggle.setAttribute("aria-expanded", filterBar.hidden ? "false" : "true");
    });
    sourceFilter.addEventListener("change", async () => {
        app.browserFilters.sourceCode = sourceFilter.value;
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        syncFilterControls();
        await load({ keepSelection: true });
    });
    overrideInput.addEventListener("change", async () => {
        app.browserFilters.overridesOnly = scope.value.startsWith("campaign:") && overrideInput.checked;
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        syncFilterControls();
        await load({ keepSelection: true });
    });
    clearFilters.addEventListener("click", async () => {
        sourceFilter.value = "";
        overrideInput.checked = false;
        app.browserFilters.sourceCode = "";
        app.browserFilters.overridesOnly = false;
        app.browserFilters.fieldFilters = {};
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        syncFilterControls();
        await load({ keepSelection: true });
    });

    search.addEventListener("input", () => {
        preserveDeepLink = false;
        clearSearch.disabled = !search.value;
        app.browserFilters.query = search.value.trim();
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            await load({ keepSelection: true });
        }, 180);
    });
    search.addEventListener("keydown", async event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (searchTimer) clearTimeout(searchTimer);
        preserveDeepLink = false;
        app.browserFilters.query = search.value.trim();
        replaceToolRoute(app, currentToolRoute(app), app.browserScope);
        await load({ keepSelection: true });
    });

    await load({ keepSelection: true });
}

export function isCompactRulesBrowserWidth(width) {
    const numericWidth = Number(width);
    return Number.isFinite(numericWidth) && numericWidth <= COMPACT_BROWSER_WIDTH;
}

function isCompactLibraryViewport(shell) {
    const containerWidth = shell?.getBoundingClientRect?.().width
        || shell?.clientWidth
        || window.innerWidth;
    return isCompactRulesBrowserWidth(containerWidth);
}

function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

async function resolvePublishedEmptyState(app) {
    const entityType = app.browserFilters.entityType ?? "";
    const family = entityType ? pluralizeEntityType(entityType).toLowerCase() : "rules";
    const hasFilters = Boolean(
        app.browserFilters.query
        || app.browserFilters.sourceCode
        || app.browserFilters.overridesOnly
        || hasClientBrowserFilters(entityType, app.browserFilters.fieldFilters));

    if (hasFilters) {
        return {
            message: `No published ${family} match the current search or filters.`,
            note: "Clear or change the search or filters to inspect other published rules in this scope.",
            showSourceLibrary: false
        };
    }

    let sourceAvailability = null;
    try {
        const sourceRecords = await app.api.searchSourceEntityPage({
            entityType: entityType || null,
            limit: 1,
            offset: 0
        });
        sourceAvailability = Array.isArray(sourceRecords) && sourceRecords.length > 0;
    } catch {
        sourceAvailability = null;
    }

    const message = `No published ${family} are available in this scope.`;
    if (sourceAvailability === true) {
        return {
            message,
            note: `Accessible ${family} source material exists in the Source Library, but it is not part of the published rules.`,
            showSourceLibrary: true
        };
    }
    if (sourceAvailability === false) {
        return {
            message,
            note: `No accessible ${entityType ? family : "source material"} is available in the Source Library.`,
            showSourceLibrary: Boolean(app.canBrowseSourceLibrary)
        };
    }
    return {
        message,
        note: "Source availability could not be checked. Published rules remain separate from source material.",
        showSourceLibrary: Boolean(app.canBrowseSourceLibrary)
    };
}

function renderIndexState(message, detail = null, action = null) {
    const node = element("div", { className: "rules-core-library-state" },
        element("p", { className: "rules-core-library-state-title", text: message }));
    if (detail) {
        node.append(element("p", {
            className: "rules-core-library-state-detail",
            text: detail
        }));
    }
    if (action) node.append(action);
    return node;
}

function renderIndexError(error, onRetry) {
    const retry = element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-primary",
        text: "Retry"
    });
    retry.addEventListener("click", onRetry);
    return renderIndexState(
        "Could not load rules.",
        describeError(error),
        retry);
}

function renderEmptyDetail(message, action = null, note = null) {
    const node = element("div", { className: "rules-core-library-detail-empty" },
        element("div", { className: "rules-core-library-detail-empty-mark", text: "R" }),
        element("p", { className: "mb-0", text: message }));
    if (note) node.append(element("p", {
        className: "small text-body-secondary mb-0 rules-core-library-empty-note",
        text: note
    }));
    if (action) node.append(action);
    return node;
}

function renderSourceLibraryAction(app) {
    if (!app.canBrowseSourceLibrary || !app.viewNavigation?.sources) return null;
    return element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-primary",
        text: "Open Source Library",
        onClick: async () => app.viewNavigation.sources()
    });
}

async function isRuleAvailableInScope(app, conceptKey, scopeValue) {
    try {
        if (scopeValue.startsWith("campaign:")) {
            await app.api.getCampaignResolvedRule(
                scopeValue.slice("campaign:".length),
                conceptKey);
        } else {
            await app.api.getGlobalResolvedRule(conceptKey);
        }
        return true;
    } catch (error) {
        if (error?.status === 404) return false;
        throw error;
    }
}

function scopeLabel(app, scopeValue) {
    if (scopeValue === "global") return "Dorks & Dice";
    return campaignName(app, scopeValue.slice("campaign:".length));
}

function campaignName(app, campaignId) {
    return app.campaigns.find(value => String(value.id) === String(campaignId))?.name
        ?? "Campaign";
}

function pluralizeEntityType(entityType) {
    const known = getKnownEntityBrowserConfigs()
        .find(configuration => configuration.entityType === entityType)?.label;
    if (known) return known;

    const label = humanizeEntityType(entityType);
    if (/s$/i.test(label)) return label;
    if (/y$/i.test(label)) return `${label.slice(0, -1)}ies`;
    return `${label}s`;
}

function humanizeEntityType(entityType) {
    const value = String(entityType ?? "");
    if (!value) return "Rule";
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}

function installReferenceBrowserStylesheet() {
    const id = "rules-wiki-reference-browser-phase-1-styles";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = new URL("./rules-reference-browser-phase1.css", import.meta.url).href;
    document.head.append(link);
}
