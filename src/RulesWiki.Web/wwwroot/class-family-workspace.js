import { alertNode, badge, clear, describeError, element, setButtonBusy } from "./ui.js";
import { renderRuleContent } from "./rule-renderer-support.js";
import { renderSemanticComparison } from "./semantic-comparison.js";
import { normalizeBrowserFieldFiltersForEntityTransition } from "./rules-browser-filters.js";
import { pushToolRoute } from "./rules-browser-routing.js";
import {
    classFamilyIdentityFields,
    classFamilyKind,
    explicitPrestigePrerequisites,
    featureGroups,
    findParentClassRelationship,
    humanizeClassFamilyType,
    isClassFamilyReference,
    progressionSurfaces
} from "./class-family-model.js";

export { isClassFamilyReference } from "./class-family-model.js";

export async function renderClassFamilyReferenceDetail(
    app,
    container,
    detail,
    campaignId,
    onBackToList,
    { renderResolutionStatus = null, isCurrent = () => true } = {})
{
    if (!isCurrent()) return;
    const reference = detail.reference;
    const variations = detail.variations ?? [];
    const context = await loadClassFamilyContextIfCurrent(app, reference, campaignId, isCurrent);
    if (!context) return;
    installClassFamilyStylesheet();

    const tabBar = element("div", {
        className: "rules-core-version-tabs class-family-view-tabs",
        attributes: { role: "tablist", "aria-label": "Class-family reference views" }
    });
    tabBar.append(element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-secondary rules-core-library-mobile-back",
        text: "← Back to list",
        onClick: onBackToList
    }));
    tabBar.append(element("span", {
        className: "rules-core-version-tabs-label",
        text: "View"
    }));

    const body = element("div", {
        className: "rules-core-library-detail-body class-family-detail-body"
    });
    const effectiveLabel = campaignId ? campaignName(app, campaignId) : "Dorks & Dice";
    const tabs = [{
        key: "effective",
        label: effectiveLabel,
        title: "Effective/default variation in the selected rules scope",
        render: () => renderClassFamilyDocumentView(app, body, detail, {
            category: reference.effectiveCategory,
            document: detail.effectiveDocument,
            variation: reference.effectiveVariation,
            campaignId,
            context,
            inspected: false,
            renderResolutionStatus
        })
    }];

    for (const variation of variations) {
        tabs.push({
            key: `variation:${variation.sourceEntityRevisionId}`,
            label: variationTabLabel(variation, variations),
            title: variationLabel(variation),
            render: () => renderClassFamilyDocumentView(app, body, detail, {
                category: variation.category || reference.effectiveCategory,
                document: variation.document,
                variation,
                campaignId,
                context,
                inspected: true,
                renderResolutionStatus: null
            })
        });
    }

    if (variations.length > 1) {
        tabs.push({
            key: "compare",
            label: "Compare",
            title: "Compare accessible class-family source variations",
            render: () => renderClassFamilyComparison(
                body,
                app,
                reference,
                variations,
                campaignId,
                renderResolutionStatus)
        });
    }

    const buttons = new Map();
    const activate = key => {
        const tab = tabs.find(value => value.key === key) ?? tabs[0];
        for (const [buttonKey, button] of buttons) {
            const selected = buttonKey === tab.key;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", selected ? "true" : "false");
            button.tabIndex = selected ? 0 : -1;
        }
        tab.render();
        app.presentRenderedFragment?.(body);
    };

    for (const tab of tabs) {
        const button = element("button", {
            type: "button",
            className: "rules-core-version-tab",
            text: tab.label,
            title: tab.title,
            attributes: {
                role: "tab",
                "aria-selected": tab.key === "effective" ? "true" : "false",
                tabindex: tab.key === "effective" ? "0" : "-1"
            }
        });
        button.addEventListener("click", () => activate(tab.key));
        buttons.set(tab.key, button);
        tabBar.append(button);
    }
    wireHorizontalTablist(tabBar, () => [...buttons.keys()], activate, key => buttons.get(key));

    const viewContext = element("div", { className: "rules-core-version-tabs-context" },
        badge(humanizeClassFamilyType(reference.effectiveCategory), "secondary"));
    if (variations.length > 1) {
        viewContext.append(element("span", {
            className: "rules-core-version-count",
            text: `${variations.length} accessible variations`
        }));
    }
    tabBar.append(viewContext);

    container.replaceChildren(tabBar, body);
    activate("effective");
    app.presentRenderedFragment?.(container);
}

export async function loadClassFamilyContextIfCurrent(
    app,
    reference,
    campaignId,
    isCurrent = () => true)
{
    const context = await loadClassFamilyContext(app, reference, campaignId);
    return isCurrent() ? context : null;
}

async function loadClassFamilyContext(app, reference, campaignId) {
    const kind = classFamilyKind(reference.effectiveCategory ?? reference.entityType);
    const context = {
        kind,
        parentDetail: null,
        subclasses: [],
        error: null
    };

    try {
        const identity = reference.referenceIdentity ?? reference.conceptKey;
        if (!identity || (kind !== "class" && kind !== "subclass")) return context;
        const relations = await app.api.getClassFamilyRelations(identity, campaignId);
        context.subclasses = relations?.subclasses ?? [];

        if (kind === "subclass") {
            const parent = relations?.parentClasses?.[0];
            if (parent?.referenceIdentity) {
                context.parentDetail = await app.api.getWikiReferenceDetail(parent.referenceIdentity, campaignId);
            }
            if (!context.subclasses.some(value => sameReference(value, reference))) {
                context.subclasses.unshift(reference);
            }
        }
    } catch (error) {
        context.error = describeError(error);
    }
    return context;
}

function renderClassFamilyDocumentView(app, container, detail, options) {
    clear(container);
    const { reference } = detail;
    const {
        category,
        document,
        variation,
        campaignId,
        context,
        inspected,
        renderResolutionStatus
    } = options;
    const kind = classFamilyKind(category) ?? classFamilyKind(reference.effectiveCategory) ?? "class";

    if (!inspected && renderResolutionStatus) {
        container.append(renderResolutionStatus(reference, campaignId));
    }
    if (inspected) {
        const inspectionText = variation?.isEffective
            ? "This source variation is also effective in the selected scope. Viewing the source tab does not change the ruling."
            : `The effective ${humanizeClassFamilyType(reference.effectiveCategory).toLowerCase()} remains ${reference.effectiveEditionDisplayName || "the selected Dorks & Dice/campaign variation"}.`;
        container.append(element("div", {
            className: "alert alert-secondary class-family-inspection-note",
            attributes: { role: "status" }
        },
        element("strong", { text: "Inspecting source variation. " }),
        inspectionText));
    }

    container.append(renderClassFamilyHeader(reference, variation, category, document, inspected));
    container.append(renderFamilyNavigation(app, reference, context, kind));
    if (context.error) {
        container.append(alertNode("secondary", `Related class-family context could not be loaded. ${context.error}`));
    }

    const layout = element("div", { className: "class-family-workspace" });
    const main = element("div", { className: "class-family-main" });
    const rail = element("aside", {
        className: "class-family-rail",
        ariaLabel: "Class summary and source context"
    });

    const identity = renderIdentityCard(document, category);
    if (identity) rail.append(identity);
    const source = renderSourceContext(reference, variation, category, campaignId, inspected);
    rail.append(source);

    if (kind === "subclass" && context.parentDetail) {
        main.append(renderParentProgressionContext(app, reference, context.parentDetail, variation));
    }

    const progression = progressionSurfaces(document);
    main.append(renderProgressionSection(progression, kind));
    main.append(renderFeaturesSection(document, category));

    if (kind === "prestigeClass") {
        main.prepend(renderPrestigeRequirements(document));
    }

    if (!main.children.length) {
        main.append(alertNode("secondary", "No structured class-family data is present in this normalized variation."));
    }

    layout.append(main, rail);
    container.append(layout);

    if ((reference.categoryHistory?.length ?? 0) > 0) {
        container.append(renderCategoryHistory(reference.categoryHistory));
    }
}

function renderClassFamilyHeader(reference, variation, category, document, inspected) {
    const name = variation?.name || reference.displayName || document?.name || "Class-family reference";
    const subtitle = [
        humanizeClassFamilyType(category),
        variation?.editionDisplayName,
        variation?.sourceCode,
        variation?.publicationDisplayName
    ].filter(Boolean).join(" · ");
    return element("header", { className: "class-family-header" },
        element("div", {},
            element("div", { className: "rules-core-eyebrow", text: "CLASS FAMILY" }),
            element("h3", { className: "class-family-title", text: name }),
            subtitle ? element("p", { className: "class-family-subtitle", text: subtitle }) : null),
        element("div", { className: "class-family-header-badges" },
            inspected ? badge("Source variation", "secondary") : badge("Effective in scope", "primary"),
            variation?.isEffective && inspected ? badge("Effective in scope", "primary") : null));
}

function renderFamilyNavigation(app, reference, context, kind) {
    const nav = element("nav", {
        className: "class-family-navigation",
        ariaLabel: "Class family navigation"
    });

    if (kind === "class") {
        nav.append(element("span", { className: "class-family-navigation-label", text: "Subclasses" }));
        if (context.subclasses.length) {
            const tablist = element("div", {
                className: "class-family-subclass-tabs",
                attributes: { role: "list", "aria-label": `${reference.displayName} subclasses` }
            });
            for (const subclass of context.subclasses) {
                const button = element("button", {
                    type: "button",
                    className: "class-family-subclass-tab",
                    text: subclass.displayName,
                    ariaLabel: `Open ${subclass.displayName} subclass`
                });
                button.addEventListener("click", () => void navigateToReference(app, subclass));
                tablist.append(element("span", { attributes: { role: "listitem" } }, button));
            }
            nav.append(tablist);
        } else {
            nav.append(element("span", {
                className: "small text-body-secondary",
                text: "No accessible subclasses are related to this class under the current source access and campaign scope."
            }));
        }
        nav.append(familyCollectionButton(app, "prestigeClass", "Browse prestige classes"));
        return nav;
    }

    if (kind === "subclass") {
        const parent = context.parentDetail?.reference;
        if (parent) {
            nav.append(referenceButton(app, parent, `Class: ${parent.displayName}`, "class-family-parent-link"));
        } else {
            const relationship = findParentClassRelationship(reference);
            nav.append(element("span", {
                className: "class-family-navigation-label",
                text: relationship ? `Class: ${relationship.relatedDisplayName}` : "Parent class not supplied"
            }));
        }

        if (context.subclasses.length) {
            const siblings = element("div", {
                className: "class-family-subclass-tabs",
                attributes: { role: "tablist", "aria-label": "Sibling subclasses" }
            });
            const keys = [];
            const controls = new Map();
            for (const subclass of context.subclasses) {
                const key = subclass.referenceIdentity ?? subclass.conceptKey;
                const selected = sameReference(subclass, reference);
                keys.push(key);
                const button = element("button", {
                    type: "button",
                    className: `class-family-subclass-tab${selected ? " is-active" : ""}`,
                    text: subclass.displayName,
                    attributes: {
                        role: "tab",
                        "aria-selected": selected ? "true" : "false",
                        tabindex: selected ? "0" : "-1"
                    }
                });
                button.addEventListener("click", () => {
                    if (!selected) void navigateToReference(app, subclass);
                });
                controls.set(key, button);
                siblings.append(button);
            }
            wireHorizontalTablist(siblings, () => keys, key => {
                const target = context.subclasses.find(value => (value.referenceIdentity ?? value.conceptKey) === key);
                if (target && !sameReference(target, reference)) void navigateToReference(app, target);
            }, key => controls.get(key));
            nav.append(siblings);
        }
        return nav;
    }

    nav.append(element("span", {
        className: "class-family-navigation-label",
        text: "Prestige class"
    }));
    nav.append(element("span", {
        className: "small text-body-secondary",
        text: "Prestige classes are independent class-family records. No subclass or parent-class relationship is inferred."
    }));
    nav.append(familyCollectionButton(app, "class", "Browse base classes"));
    return nav;
}

function renderIdentityCard(document, category) {
    const fields = classFamilyIdentityFields(document, category);
    if (!fields.length) return null;
    const card = element("section", { className: "class-family-card" },
        element("h4", { className: "class-family-section-title", text: "Class summary" }));
    const list = element("dl", { className: "class-family-summary-list" });
    for (const field of fields) {
        list.append(
            element("dt", { text: field.label }),
            element("dd", {}, renderDisplayValue(field.value)));
    }
    card.append(list);
    return card;
}

function renderProgressionSection(surfaces, kind) {
    const section = element("section", { className: "class-family-section class-family-progression" },
        element("div", { className: "class-family-section-heading" },
            element("div", {},
                element("div", { className: "rules-core-eyebrow", text: "PROGRESSION" }),
                element("h4", {
                    className: "class-family-section-title",
                    text: kind === "prestigeClass" ? "Independent progression" : "Level progression"
                }))));

    if (!surfaces.length) {
        section.append(element("p", {
            className: "class-family-empty-note",
            text: "No normalized progression table is present in this source variation. Rules Wiki does not manufacture missing level mechanics."
        }));
        return section;
    }

    for (const surface of surfaces) section.append(renderProgressionTable(surface));
    return section;
}

function renderProgressionTable(surface) {
    const wrapper = element("section", { className: "class-family-progression-surface" },
        element("h5", { className: "class-family-progression-title", text: surface.title }));
    const scroller = element("div", {
        className: "class-family-table-wrap",
        attributes: { tabindex: "0", role: "region", "aria-label": `${surface.title} table` }
    });
    const table = element("table", { className: "table table-sm class-family-table" });
    const head = element("thead");
    const headRow = element("tr");
    surface.columns.forEach(column => headRow.append(element("th", {
        text: column.label,
        attributes: { scope: "col" }
    })));
    head.append(headRow);
    const body = element("tbody");
    surface.rows.forEach(row => {
        const tr = element("tr");
        row.forEach((value, index) => {
            const tag = index === 0 && /^level$/i.test(surface.columns[index]?.label ?? "") ? "th" : "td";
            const attributes = tag === "th" ? { scope: "row" } : undefined;
            tr.append(element(tag, { attributes }, renderDisplayValue(value)));
        });
        body.append(tr);
    });
    table.append(head, body);
    scroller.append(table);
    wrapper.append(scroller);
    return wrapper;
}

function renderFeaturesSection(document, category) {
    const groups = featureGroups(document, category);
    const section = element("section", { className: "class-family-section class-family-features" },
        element("div", { className: "class-family-section-heading" },
            element("div", {},
                element("div", { className: "rules-core-eyebrow", text: "FEATURES" }),
                element("h4", { className: "class-family-section-title", text: "Features by level" }))));

    if (!groups.length) {
        section.append(element("p", {
            className: "class-family-empty-note",
            text: "No structured feature list is present in this source variation."
        }));
        return section;
    }

    const list = element("div", { className: "class-family-feature-levels" });
    for (const group of groups) {
        const levelLabel = group.level ? `Level ${group.level}` : "Unleveled source features";
        const item = element("section", { className: "class-family-feature-level" },
            element("div", { className: "class-family-feature-level-heading" },
                element("h5", { text: levelLabel }),
                group.level ? badge(humanizeClassFamilyType(category), "secondary") : null));
        const entries = element("div", { className: "class-family-feature-entries" });
        for (const feature of group.features) {
            entries.append(element("div", { className: "class-family-feature-entry" }, renderDisplayValue(feature)));
        }
        item.append(entries);
        list.append(item);
    }
    section.append(list);
    return section;
}

function renderPrestigeRequirements(document) {
    const prerequisites = explicitPrestigePrerequisites(document);
    const section = element("section", { className: "class-family-section class-family-prerequisites" },
        element("div", { className: "rules-core-eyebrow", text: "ENTRY" }),
        element("h4", { className: "class-family-section-title", text: "Prerequisites" }));
    if (prerequisites === null || prerequisites === undefined || prerequisites === "") {
        section.append(element("p", {
            className: "class-family-empty-note",
            text: "No normalized prestige-class prerequisites are present in this variation."
        }));
    } else {
        section.append(element("div", { className: "class-family-prerequisite-body" }, renderDisplayValue(prerequisites)));
    }
    return section;
}

function renderParentProgressionContext(app, reference, parentDetail, inspectedVariation) {
    const selected = selectParentVariation(parentDetail, inspectedVariation);
    const document = selected?.document ?? parentDetail.effectiveDocument;
    const label = selected
        ? `${selected.editionDisplayName || "Matching edition"} parent variation`
        : "Effective parent class";
    const section = element("section", { className: "class-family-parent-context" },
        element("div", { className: "class-family-section-heading" },
            element("div", {},
                element("div", { className: "rules-core-eyebrow", text: "PARENT CLASS CONTEXT" }),
                element("h4", { className: "class-family-section-title", text: parentDetail.reference.displayName }),
                element("p", {
                    className: "class-family-context-note",
                    text: `${label}. Subclass features below remain distinct from the base-class progression.`
                })),
            referenceButton(app, parentDetail.reference, "Open class", "btn btn-sm btn-outline-secondary")));
    const surfaces = progressionSurfaces(document);
    if (!surfaces.length) {
        section.append(element("p", {
            className: "class-family-empty-note",
            text: "The accessible parent variation does not contain a normalized progression table."
        }));
        return section;
    }
    const preview = element("div", { className: "class-family-parent-progression" });
    for (const surface of surfaces.slice(0, 2)) preview.append(renderProgressionTable(surface));
    section.append(preview);
    return section;
}

function selectParentVariation(parentDetail, childVariation) {
    if (!childVariation?.editionKey) return null;
    const sameEdition = (parentDetail.variations ?? []).filter(value =>
        value.editionKey === childVariation.editionKey);
    const exactPackage = sameEdition.filter(value =>
        childVariation.packageKey && value.packageKey === childVariation.packageKey);
    if (exactPackage.length === 1) return exactPackage[0];
    const exactSource = sameEdition.filter(value =>
        childVariation.sourceCode && value.sourceCode === childVariation.sourceCode);
    if (exactSource.length === 1) return exactSource[0];
    return sameEdition.length === 1 ? sameEdition[0] : null;
}

function renderSourceContext(reference, variation, category, campaignId, inspected) {
    const card = element("section", { className: "class-family-card" },
        element("h4", { className: "class-family-section-title", text: "Reference context" }));
    const list = element("dl", { className: "class-family-summary-list" });
    const entries = [
        ["Scope", campaignId ? "Campaign" : "Dorks & Dice"],
        ["View", inspected ? "Inspected source variation" : "Effective rule"],
        ["Category", humanizeClassFamilyType(category)],
        ["Edition", variation?.editionDisplayName || reference.effectiveEditionDisplayName],
        ["Source", variation?.sourceCode],
        ["Publication", variation?.publicationDisplayName],
        ["Package", variation?.packageDisplayName],
        ["Reference identity", reference.referenceIdentity]
    ];
    for (const [label, value] of entries) {
        if (!value) continue;
        list.append(element("dt", { text: label }), element("dd", { text: String(value) }));
    }
    card.append(list);
    return card;
}

function renderCategoryHistory(history) {
    const section = element("details", { className: "rules-core-context-disclosure class-family-history" });
    const list = element("ul", { className: "mb-0" });
    for (const entry of history) {
        list.append(element("li", {
            text: `${humanizeClassFamilyType(entry.category)}${entry.editions?.length ? ` · ${entry.editions.join(", ")}` : ""}`
        }));
    }
    section.append(
        element("summary", { text: "Source and category history" }),
        element("div", { className: "rules-core-context-disclosure-body" }, list));
    return section;
}

function renderClassFamilyComparison(
    container,
    app,
    reference,
    variations,
    campaignId,
    renderResolutionStatus)
{
    clear(container);
    container.append(element("div", { className: "rules-core-comparison-heading" },
        element("div", {},
            element("div", { className: "rules-core-eyebrow", text: "CLASS-FAMILY VERSION DIFFERENCES" }),
            element("h3", { className: "h4 mb-1", text: `Compare ${reference.displayName}` }),
            element("p", {
                className: "small text-body-secondary mb-0",
                text: "Progression outlines below are presentation-only. Rules Core semantic comparison remains authoritative for compatibility and conflicts."
            }))));

    const left = variationSelect(variations, "Left source variation");
    const right = variationSelect(variations, "Right source variation");
    left.value = variations[0].sourceEntityRevisionId;
    right.value = variations[1].sourceEntityRevisionId;
    const compare = element("button", {
        type: "button",
        className: "btn btn-sm btn-primary",
        text: "Compare"
    });
    const result = element("div", { className: "rules-core-comparison-result" });
    container.append(element("div", { className: "rules-core-comparison-controls" },
        comparisonField("Left", left),
        comparisonField("Right", right),
        element("div", { className: "rules-core-comparison-action" }, compare)), result);

    compare.addEventListener("click", async () => {
        result.replaceChildren();
        if (left.value === right.value) {
            result.append(alertNode("secondary", "Choose two different source variations."));
            return;
        }
        setButtonBusy(compare, true, "Comparing…");
        try {
            const leftVariation = variations.find(value => value.sourceEntityRevisionId === left.value);
            const rightVariation = variations.find(value => value.sourceEntityRevisionId === right.value);
            result.append(renderProgressionComparison(leftVariation, rightVariation));
            const semanticHost = element("section", { className: "class-family-semantic-comparison" },
                element("h4", { className: "class-family-section-title", text: "Rules Core semantic comparison" }));
            result.append(semanticHost);
            const comparison = await app.api.compareRuleVersions({
                referenceIdentity: reference.referenceIdentity,
                leftSourceEntityRevisionId: left.value,
                rightSourceEntityRevisionId: right.value
            });
            renderSemanticComparison(semanticHost, comparison, {
                leftLabel: leftVariation ? variationLabel(leftVariation) : "Left",
                rightLabel: rightVariation ? variationLabel(rightVariation) : "Right"
            });

            if (renderResolutionStatus) {
                result.append(element("section", {
                    className: "rules-core-comparison-adjudication class-family-comparison-adjudication"
                },
                element("div", {},
                    element("strong", { text: "Need a ruling?" }),
                    element("div", {
                        className: "small text-body-secondary",
                        text: "Continue through the same authority-aware ruling or source-normalization action used by the reference browser."
                    })),
                renderResolutionStatus(reference, campaignId)));
            }
        } catch (error) {
            result.replaceChildren(alertNode("danger", describeError(error)));
        } finally {
            setButtonBusy(compare, false);
        }
    });
    compare.click();
}

function renderProgressionComparison(leftVariation, rightVariation) {
    const section = element("section", { className: "class-family-comparison-progression" },
        element("h4", { className: "class-family-section-title", text: "Progression and feature outlines" }));
    const grid = element("div", { className: "class-family-comparison-grid" });
    grid.append(
        renderVariationOutline(leftVariation, "Left"),
        renderVariationOutline(rightVariation, "Right"));
    section.append(grid);
    return section;
}

function renderVariationOutline(variation, side) {
    const panel = element("article", { className: "class-family-comparison-panel" },
        element("div", { className: "rules-core-eyebrow", text: side.toUpperCase() }),
        element("h5", { text: variation ? variationLabel(variation) : side }));
    if (!variation) return panel;
    const surfaces = progressionSurfaces(variation.document);
    const features = featureGroups(variation.document, variation.category);
    if (surfaces.length) {
        const list = element("ul", { className: "class-family-outline-list" });
        for (const surface of surfaces) {
            list.append(element("li", {
                text: `${surface.title}: ${surface.rows.length} level/progression rows · ${surface.columns.map(value => value.label).join(", ")}`
            }));
        }
        panel.append(list);
    } else {
        panel.append(element("p", { className: "class-family-empty-note", text: "No normalized progression table." }));
    }
    if (features.length) {
        panel.append(element("p", {
            className: "small mb-0",
            text: `${features.filter(value => value.level).length} explicit feature-level group(s); ${features.filter(value => !value.level).reduce((sum, value) => sum + value.features.length, 0)} unleveled source feature(s).`
        }));
    }
    return panel;
}

async function navigateToReference(app, target) {
    const previous = app.browserFilters?.entityType ?? "";
    const next = target.effectiveCategory ?? target.entityType ?? previous;
    app.browserFilters.entityType = next;
    app.browserFilters.query = "";
    app.browserFilters.fieldFilters = normalizeBrowserFieldFiltersForEntityTransition(
        previous,
        next,
        app.browserFilters.fieldFilters);
    const identity = target.referenceIdentity ?? target.conceptKey;
    app.browserSelectedConceptKey = identity;
    app.browserDeepLink = identity;
    const route = target.browserLink?.toolRelativePath;
    if (!route) return;
    pushToolRoute(app, route, app.browserScope);
    await app.render();
}

function referenceButton(app, reference, label, className) {
    return element("button", {
        type: "button",
        className: className || "btn btn-sm btn-outline-secondary",
        text: label,
        onClick: () => void navigateToReference(app, reference)
    });
}

function familyCollectionButton(app, entityType, label) {
    return element("button", {
        type: "button",
        className: "btn btn-sm btn-outline-secondary",
        text: label,
        onClick: () => void app.navigateRuleFamily?.(entityType)
    });
}

function variationSelect(variations, ariaLabel) {
    const select = element("select", { className: "form-select form-select-sm", ariaLabel });
    for (const variation of variations) {
        select.append(element("option", {
            value: variation.sourceEntityRevisionId,
            text: variationLabel(variation)
        }));
    }
    return select;
}

function comparisonField(label, control) {
    return element("label", { className: "rules-core-comparison-field" },
        element("span", { text: label }), control);
}

function variationTabLabel(variation, variations) {
    const edition = String(variation.editionDisplayName ?? "").trim();
    const sameEdition = variations.filter(value =>
        String(value.editionDisplayName ?? "").trim().toLowerCase() === edition.toLowerCase()).length;
    if (edition && sameEdition === 1) return edition;
    return [edition, variation.sourceCode, humanizeClassFamilyType(variation.category)]
        .filter(Boolean)
        .join(" · ");
}

function variationLabel(variation) {
    return [
        variation.editionDisplayName,
        humanizeClassFamilyType(variation.category),
        variation.sourceCode,
        variation.publicationDisplayName,
        variation.sourceRevisionNumber ? `rev. ${variation.sourceRevisionNumber}` : null
    ].filter(Boolean).join(" · ");
}

function renderDisplayValue(value) {
    if (value && typeof value === "object" && !Array.isArray(value)
        && Number.isFinite(Number(value.faces))) {
        const number = Number.isFinite(Number(value.number)) ? Number(value.number) : 1;
        return document.createTextNode(`${number > 1 ? number : ""}d${Number(value.faces)}`);
    }
    return renderRuleContent(value);
}

function sameReference(left, right) {
    const leftIdentity = left?.referenceIdentity ?? left?.conceptKey;
    const rightIdentity = right?.referenceIdentity ?? right?.conceptKey;
    return Boolean(leftIdentity && rightIdentity && leftIdentity === rightIdentity);
}

function wireHorizontalTablist(tablist, getKeys, activate, getControl, { activateOnFocus = true } = {}) {
    tablist.addEventListener("keydown", event => {
        if (!event.target?.matches?.("[role='tab']")) return;
        const keys = getKeys();
        if (!keys.length) return;
        const controls = keys.map(getControl);
        const current = controls.indexOf(event.target);
        if (current < 0) return;
        let next = current;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % keys.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + keys.length) % keys.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = keys.length - 1;
        else return;
        event.preventDefault();
        const control = controls[next];
        control?.focus?.();
        if (activateOnFocus) activate(keys[next]);
    });
}

function campaignName(app, campaignId) {
    return app.campaigns.find(value => String(value.id) === String(campaignId))?.name ?? "Campaign";
}

function installClassFamilyStylesheet() {
    const id = "rules-wiki-class-family-phase-3-styles";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = new URL("./class-family-workspace.css", import.meta.url).href;
    document.head.append(link);
}
