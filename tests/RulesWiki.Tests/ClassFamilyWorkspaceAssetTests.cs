namespace RulesWiki.Tests;

public sealed class ClassFamilyWorkspaceAssetTests
{
    [Fact]
    public void ClassFamilyDetailIsSpecializedWithoutReplacingGenericReferenceFallback()
    {
        var detail = ReadWebAsset("rules-browser-detail.js");
        var workspace = ReadWebAsset("class-family-workspace.js");
        var model = ReadWebAsset("class-family-model.js");

        Assert.Contains("isClassFamilyReference(detail)", detail, StringComparison.Ordinal);
        Assert.Contains("renderClassFamilyReferenceDetail", detail, StringComparison.Ordinal);
        Assert.Contains("renderGenericReferenceDetail", detail, StringComparison.Ordinal);
        Assert.Contains("class", model, StringComparison.Ordinal);
        Assert.Contains("subclass", model, StringComparison.Ordinal);
        Assert.Contains("prestigeclass", model, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Prestige classes are independent class-family records", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("Prestige classes are subclasses", workspace, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassWorkspaceUsesCoreRelatedReferenceCollectionAndStableReferenceRoutes()
    {
        var workspace = ReadWebAsset("class-family-workspace.js");
        var detail = ReadWebAsset("rules-browser-detail.js");
        var referenceApi = ReadWebAsset("rules-reference-api.js");

        Assert.Contains("getClassFamilyRelations", referenceApi, StringComparison.Ordinal);
        Assert.Contains("/class-family", referenceApi, StringComparison.Ordinal);
        Assert.Contains("app.api.getClassFamilyRelations(identity, campaignId)", workspace, StringComparison.Ordinal);
        Assert.Contains("loadClassFamilyContextIfCurrent", workspace, StringComparison.Ordinal);
        Assert.Contains("isCurrent: () => requestSerial === getCurrentSerial()", detail, StringComparison.Ordinal);
        Assert.Contains("relations?.parentClasses", workspace, StringComparison.Ordinal);
        Assert.Contains("relations?.subclasses", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("loadSubclassesForClass", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("PAGE_SIZE", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("categoryMode", workspace, StringComparison.Ordinal);
        Assert.Contains("target.browserLink?.toolRelativePath", workspace, StringComparison.Ordinal);
        Assert.Contains("pushToolRoute(app, route, app.browserScope)", workspace, StringComparison.Ordinal);
        Assert.Contains("normalizeBrowserFieldFiltersForEntityTransition", workspace, StringComparison.Ordinal);
    }

    [Fact]
    public void ClassWorkspacePreservesEffectiveVariationSemanticComparisonAndAdjudicationContinuation()
    {
        var workspace = ReadWebAsset("class-family-workspace.js");
        var detail = ReadWebAsset("rules-browser-detail.js");

        Assert.Contains("Inspecting source variation", workspace, StringComparison.Ordinal);
        Assert.Contains("The effective", workspace, StringComparison.Ordinal);
        Assert.Contains("variation?.isEffective", workspace, StringComparison.Ordinal);
        Assert.Contains("app.api.compareRuleVersions", workspace, StringComparison.Ordinal);
        Assert.Contains("renderSemanticComparison", workspace, StringComparison.Ordinal);
        Assert.Contains("Rules Core semantic comparison remains authoritative", workspace, StringComparison.Ordinal);
        Assert.Contains("Need a ruling?", workspace, StringComparison.Ordinal);
        Assert.Contains("renderResolutionStatus(reference, campaignId)", workspace, StringComparison.Ordinal);
        Assert.Contains("referenceAdjudicationTarget", detail, StringComparison.Ordinal);
        Assert.Contains("referenceNormalizationTarget", detail, StringComparison.Ordinal);
        Assert.Contains("Edit campaign rule", detail, StringComparison.Ordinal);
        Assert.Contains("Edit Dorks & Dice rule", detail, StringComparison.Ordinal);
        Assert.Contains("Create/bind Dorks & Dice rule", detail, StringComparison.Ordinal);
    }

    [Fact]
    public void ProgressionFeaturesAndPrestigeRequirementsUseAuthoritativeCoreContracts()
    {
        var workspace = ReadWebAsset("class-family-workspace.js");
        var model = ReadWebAsset("class-family-model.js");
        var referenceApi = ReadWebAsset("rules-reference-api.js");

        Assert.Contains("classTableGroups", model, StringComparison.Ordinal);
        Assert.Contains("rowsSpellProgression", model, StringComparison.Ordinal);
        Assert.Contains("baseAttackProgression", model, StringComparison.Ordinal);
        Assert.Contains("saveProgressions", model, StringComparison.Ordinal);
        Assert.Contains("classSkills", model, StringComparison.Ordinal);
        Assert.Contains("registerClassFamilyAdvancementMetadata", referenceApi, StringComparison.Ordinal);
        Assert.Contains("registerClassFamilyAdvancementMetadata", model, StringComparison.Ordinal);
        Assert.Contains("detail.effectiveAdvancementFeatures", model, StringComparison.Ordinal);
        Assert.Contains("variation?.advancementFeatures", model, StringComparison.Ordinal);
        Assert.Contains("rulesCoreCharacter(document).advancementFeatures", model, StringComparison.Ordinal);
        Assert.Contains("rulesCoreCharacter(document).prerequisites", model, StringComparison.Ordinal);
        Assert.Contains("new WeakMap()", model, StringComparison.Ordinal);
        Assert.DoesNotContain("Object.defineProperty", referenceApi, StringComparison.Ordinal);
        Assert.DoesNotContain("Object.defineProperty", model, StringComparison.Ordinal);
        Assert.Contains("No normalized progression table is present", workspace, StringComparison.Ordinal);
        Assert.Contains("Rules Wiki does not manufacture missing level mechanics", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("BaseAttackBonus(", workspace, StringComparison.Ordinal);
        Assert.DoesNotContain("BaseAttackBonus(", model, StringComparison.Ordinal);
        Assert.DoesNotContain("split('|')", model, StringComparison.Ordinal);
    }

    [Fact]
    public void ClassWorkspaceProvidesKeyboardTableAndResponsiveAccessibility()
    {
        var workspace = ReadWebAsset("class-family-workspace.js");
        var css = ReadWebAsset("class-family-workspace.css");

        Assert.Contains("role: \"tablist\"", workspace, StringComparison.Ordinal);
        Assert.Contains("aria-selected", workspace, StringComparison.Ordinal);
        Assert.Contains("ArrowRight", workspace, StringComparison.Ordinal);
        Assert.Contains("ArrowLeft", workspace, StringComparison.Ordinal);
        Assert.Contains("Home", workspace, StringComparison.Ordinal);
        Assert.Contains("End", workspace, StringComparison.Ordinal);
        Assert.Contains("scope: \"col\"", workspace, StringComparison.Ordinal);
        Assert.Contains("scope: \"row\"", workspace, StringComparison.Ordinal);
        Assert.Contains("role: \"region\"", workspace, StringComparison.Ordinal);
        Assert.Contains("container-type: inline-size", css, StringComparison.Ordinal);
        Assert.Contains("@container class-family-workspace (max-width: 780px)", css, StringComparison.Ordinal);
        Assert.Contains("@container class-family-workspace (max-width: 520px)", css, StringComparison.Ordinal);
        Assert.Contains("focus-visible", css, StringComparison.Ordinal);
        Assert.DoesNotContain("MutationObserver", workspace, StringComparison.Ordinal);
    }

    [Fact]
    public void ClassFamilyViewAndSiblingNavigationUseCorrectAriaSemantics()
    {
        var workspace = ReadWebAsset("class-family-workspace.js");

        var tabListIndex = workspace.IndexOf(
            "className: \"class-family-view-tablist\"",
            StringComparison.Ordinal);
        var backButtonIndex = workspace.IndexOf(
            "className: \"btn btn-sm btn-outline-secondary rules-core-library-mobile-back\"",
            StringComparison.Ordinal);
        var viewLabelIndex = workspace.IndexOf(
            "className: \"rules-core-version-tabs-label\"",
            StringComparison.Ordinal);
        var tabPanelIndex = workspace.IndexOf(
            "role: \"tabpanel\"",
            StringComparison.Ordinal);

        Assert.True(tabListIndex > 0, "The top-level view switcher should contain a dedicated tablist.");
        Assert.True(backButtonIndex >= 0 && backButtonIndex < tabListIndex, "The Back button must be outside the top-level tablist.");
        Assert.True(viewLabelIndex >= 0 && viewLabelIndex < tabListIndex, "The View label must be outside the top-level tablist.");

        Assert.Contains(
            "id: viewPanelId,",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            "role: \"tabpanel\",",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            "\"aria-controls\": viewPanelId,",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            "body.setAttribute(\"aria-labelledby\", button.id)",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            "tabList.append(button)",
            workspace,
            StringComparison.Ordinal);
        Assert.Contains(
            "tabBar.append(tabList, viewContext)",
            workspace,
            StringComparison.Ordinal);

        var siblingStart = workspace.IndexOf(
            "if (kind === \"subclass\")",
            StringComparison.Ordinal);
        var siblingEnd = workspace.IndexOf(
            "        return nav;",
            siblingStart,
            StringComparison.Ordinal);
        Assert.True(siblingStart >= 0 && siblingEnd > siblingStart, "The subclass navigation block should be present.");
        var siblingSection = workspace[siblingStart..siblingEnd];
        Assert.Contains(
            "attributes: { role: \"list\", \"aria-label\": \"Sibling subclasses\" }",
            siblingSection,
            StringComparison.Ordinal);
        Assert.Contains(
            "attributes: { role: \"listitem\" }",
            siblingSection,
            StringComparison.Ordinal);
        Assert.Contains(
            "\"aria-current\": selected ? \"page\" : null",
            siblingSection,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "role: \"tablist\"",
            siblingSection,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "role: \"tab\"",
            siblingSection,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "wireHorizontalTablist(siblings",
            siblingSection,
            StringComparison.Ordinal);
    }

    private static string ReadWebAsset(string filename)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null
               && !File.Exists(Path.Combine(directory.FullName, "dorks-and-dice-rules-wiki.slnx")))
        {
            directory = directory.Parent;
        }

        if (directory is null)
        {
            throw new InvalidOperationException("Could not locate the Rules Wiki repository root.");
        }

        return File.ReadAllText(Path.Combine(
            directory.FullName,
            "src",
            "RulesWiki.Web",
            "wwwroot",
            filename));
    }
}
