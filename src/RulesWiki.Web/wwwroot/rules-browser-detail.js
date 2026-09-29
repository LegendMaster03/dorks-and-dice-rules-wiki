import {
    alertNode,
    badge,
    clear,
    definitionList,
    describeError,
    element,
    setButtonBusy
} from "./ui.js";
import { renderResolvedRule } from "./rule-renderers.js";
import { renderSemanticComparison } from "./semantic-comparison.js";

export async function renderRuleDetailPane(
    app,
    container,
    referenceIdentity,
    scopeValue,
    requestSerial,
    getCurrentSerial,
    onBackToList)
{
    container.replaceChildren(element("div", {
        className: "rules-core-library-detail-loading",
        text: "Loading reference…"
    }));

    const campaignId = scopeValue.startsWith("campaign:")
        ? scopeValue.slice("campaign:".length)
        : null;
    try {
        const detail = await app.api.getWikiReferenceDetail(referenceIdentity, campaignId);
        if (requestSerial !== getCurrentSerial()) return;

        const reference = detail.reference;
        const variations = detail.variations ?? [];
        const tabBar = element("div", {
            className: "rules-core-version-tabs",
            attributes: { role: "tablist", "aria-label": "Reference views" }
        });
        tabBar.append(element("button", {
            type: "button",
            className: "btn btn-sm btn-outline-secondary rules-core-library-mobile-back",
            text: "← Back to list",
            onClick: onBackToList
        }));
        const body = element("div", { className: "rules-core-library-detail-body" });

        const effectiveLabel = campaignId ? campaignName(app, campaignId) : "Dorks & Dice";
        const tabs = [{
            key: "effective",
            label: effectiveLabel,
            title: "Effective/default variation in the selected rules scope",
            render: () => renderEffectiveReference(body, detail, campaignId)
        }];
        for (const variation of variations) {
            tabs.push({
                key: `variation:${variation.sourceEntityRevisionId}`,
                label: variationTabLabel(variation, variations),
                title: variationLabel(variation),
                render: () => renderVariation(body, reference, variation)
            });
        }
        if (variations.length > 1) {
            tabs.push({
                key: "compare",
                label: "Compare",
                title: "Compare accessible source variations",
                render: () => renderComparison(body, app, reference, variations)
            });
        }

        const buttons = new Map();
        const activate = key => {
            for (const [buttonKey, button] of buttons) {
                const selected = buttonKey === key;
                button.classList.toggle("is-active", selected);
                button.setAttribute("aria-selected", selected ? "true" : "false");
            }
            const tab = tabs.find(value => value.key === key) ?? tabs[0];
            tab.render();
            app.presentRenderedFragment?.(body);
        };

        tabBar.append(element("span", {
            className: "rules-core-version-tabs-label",
            text: "View"
        }));
        for (const tab of tabs) {
            const button = element("button", {
                type: "button",
                className: "rules-core-version-tab",
                text: tab.label,
                title: tab.title,
                attributes: { role: "tab", "aria-selected": tab.key === "effective" ? "true" : "false" }
            });
            button.addEventListener("click", () => activate(tab.key));
            buttons.set(tab.key, button);
            tabBar.append(button);
        }

        const context = element("div", { className: "rules-core-version-tabs-context" },
            badge(humanizeEntityType(reference.effectiveCategory), "secondary"));
        if (variations.length > 1) {
            context.append(element("span", {
                className: "rules-core-version-count",
                text: `${variations.length} accessible variations`
            }));
        }
        tabBar.append(context);

        container.replaceChildren(tabBar, body);
        activate("effective");
        app.presentRenderedFragment?.(container);
    } catch (error) {
        if (requestSerial !== getCurrentSerial()) return;
        container.replaceChildren(alertNode("danger", describeError(error)));
        app.presentRenderedFragment?.(container);
    }
}

function renderEffectiveReference(container, detail, campaignId) {
    clear(container);
    const reference = detail.reference;
    const effective = reference.effectiveVariation;
    container.append(renderResolutionStatus(reference, campaignId));
    container.append(element("section", { className: "rules-core-effective-rule" },
        renderResolvedRule(reference.effectiveCategory, detail.effectiveDocument, {
            displayName: reference.displayName,
            showDocument: String(reference.effectiveCategory).toLowerCase() !== "monster"
        })));

    const metadata = element("section", { className: "card card-body mb-3 rules-core-detail-context-card" });
    metadata.append(
        element("h3", { className: "h5", text: "Reference context" }),
        definitionList([
            ["Scope", campaignId ? "Campaign" : "Dorks & Dice"],
            ["Effective category", humanizeEntityType(reference.effectiveCategory)],
            ["Effective edition", reference.effectiveEditionDisplayName],
            ["Source", effective.sourceCode],
            ["Publication", effective.publicationDisplayName],
            ["Package", effective.packageDisplayName],
            ["Reference identity", reference.referenceIdentity]
        ]));
    container.append(metadata);

    if ((reference.categoryHistory?.length ?? 0) > 0) {
        const history = element("section", { className: "card card-body mb-3 rules-core-detail-context-card" });
        history.append(element("h3", { className: "h5", text: "Category history" }));
        const list = element("ul", { className: "mb-0" });
        for (const entry of reference.categoryHistory) {
            list.append(element("li", {
                text: `${humanizeEntityType(entry.category)}${entry.editions?.length ? ` · ${entry.editions.join(", ")}` : ""}`
            }));
        }
        history.append(list);
        container.append(history);
    }
}

function renderResolutionStatus(reference, campaignId) {
    const state = reference.resolutionState;
    let title;
    let detail;
    if (state === "campaign-override") {
        title = "Campaign override";
        detail = "This campaign explicitly selects the effective variation shown below.";
    } else if (state === "inherited") {
        title = "Inherited Dorks & Dice ruling";
        detail = "This campaign inherits its effective variation from the published global baseline.";
    } else if (state === "resolved") {
        title = "Dorks & Dice ruling";
        detail = "A published Rules Layer decision selects the effective variation shown below.";
    } else {
        title = "Unresolved default";
        detail = "No applicable published ruling exists. Rules Core is showing the newest accessible applicable variation without creating a rule decision.";
    }

    return element("div", { className: "rules-core-ruling-status" },
        element("div", {},
            element("div", { className: "rules-core-ruling-status-title", text: title }),
            element("div", { className: "small text-body-secondary", text: detail })),
        badge(campaignId ? "Campaign scope" : "Global scope", state === "unresolved-fallback" ? "secondary" : "primary"));
}

function renderVariation(container, reference, variation) {
    clear(container);
    const category = variation.category || variation.nativeEntityType || reference.effectiveCategory;
    container.append(element("div", { className: "rules-core-source-version-heading" },
        element("div", {},
            element("div", { className: "rules-core-eyebrow", text: "SOURCE VARIATION" }),
            element("h3", { className: "h4 mb-1", text: variation.name || reference.displayName }),
            element("div", {
                className: "text-body-secondary",
                text: [
                    variation.editionDisplayName,
                    humanizeEntityType(variation.nativeEntityType),
                    variation.sourceCode,
                    variation.publicationDisplayName
                ].filter(Boolean).join(" · ")
            })),
        variation.isEffective ? badge("Effective in scope", "primary") : null));

    container.append(element("section", { className: "rules-core-effective-rule" },
        renderResolvedRule(category, variation.document, {
            displayName: variation.name || reference.displayName,
            showDocument: String(category).toLowerCase() !== "monster"
        })));

    const provenance = element("details", { className: "rules-core-context-disclosure" });
    provenance.append(
        element("summary", { text: "Source provenance" }),
        element("div", { className: "rules-core-context-disclosure-body" },
            definitionList([
                ["Edition", variation.editionDisplayName],
                ["Source-native category", humanizeEntityType(variation.nativeEntityType)],
                ["Source", variation.sourceCode],
                ["Publication", variation.publicationDisplayName],
                ["Publication date", variation.publicationDate],
                ["Package", variation.packageDisplayName],
                ["Source revision", `#${variation.sourceRevisionNumber}`]
            ])));
    container.append(provenance);
}

function renderComparison(container, app, reference, variations) {
    clear(container);
    container.append(element("div", { className: "rules-core-comparison-heading" },
        element("div", {},
            element("div", { className: "rules-core-eyebrow", text: "VERSION DIFFERENCES" }),
            element("h3", { className: "h4 mb-1", text: `Compare ${reference.displayName}` }),
            element("p", {
                className: "small text-body-secondary mb-0",
                text: "Comparison is read-only. Accessible historical variations do not require Rules Lawyer authority."
            }))));

    const left = element("select", { className: "form-select form-select-sm", ariaLabel: "Left source variation" });
    const right = element("select", { className: "form-select form-select-sm", ariaLabel: "Right source variation" });
    for (const variation of variations) {
        const label = variationLabel(variation);
        left.append(element("option", { value: variation.sourceEntityRevisionId, text: label }));
        right.append(element("option", { value: variation.sourceEntityRevisionId, text: label }));
    }
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
        element("div", { className: "rules-core-comparison-action" }, compare)),
    result);

    compare.addEventListener("click", async () => {
        result.replaceChildren();
        if (left.value === right.value) {
            result.append(alertNode("secondary", "Choose two different source variations."));
            return;
        }
        setButtonBusy(compare, true, "Comparing…");
        try {
            const comparison = await app.api.compareRuleVersions({
                referenceIdentity: reference.referenceIdentity,
                leftSourceEntityRevisionId: left.value,
                rightSourceEntityRevisionId: right.value
            });
            const leftVariation = variations.find(value => value.sourceEntityRevisionId === left.value);
            const rightVariation = variations.find(value => value.sourceEntityRevisionId === right.value);
            renderSemanticComparison(result, comparison, {
                leftLabel: leftVariation ? variationLabel(leftVariation) : "Left",
                rightLabel: rightVariation ? variationLabel(rightVariation) : "Right"
            });
        } catch (error) {
            result.replaceChildren(alertNode("danger", describeError(error)));
        } finally {
            setButtonBusy(compare, false);
        }
    });
    compare.click();
}

function comparisonField(label, control) {
    return element("label", { className: "rules-core-comparison-field" },
        element("span", { text: label }),
        control);
}

function variationTabLabel(variation, variations) {
    const edition = String(variation.editionDisplayName ?? "").trim();
    const sameEdition = variations.filter(value =>
        String(value.editionDisplayName ?? "").trim().toLowerCase() === edition.toLowerCase()).length;
    if (edition && sameEdition === 1) return edition;
    return [edition, variation.sourceCode, humanizeEntityType(variation.nativeEntityType)]
        .filter(Boolean)
        .join(" · ");
}

function variationLabel(variation) {
    return [
        variation.editionDisplayName,
        humanizeEntityType(variation.nativeEntityType),
        variation.sourceCode,
        variation.publicationDisplayName,
        `rev. ${variation.sourceRevisionNumber}`
    ].filter(Boolean).join(" · ");
}

function campaignName(app, campaignId) {
    return app.campaigns.find(value => String(value.id) === String(campaignId))?.name
        ?? "Campaign";
}

function humanizeEntityType(entityType) {
    const value = String(entityType ?? "");
    if (!value) return "Rule";
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, match => match.toUpperCase());
}
