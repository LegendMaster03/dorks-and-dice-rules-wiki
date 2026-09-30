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
        var referenceApi = ReadWebAsset("rules-reference-api.js");

        Assert.Contains("getClassFamilyRelations", referenceApi, StringComparison.Ordinal);
        Assert.Contains("/class-family", referenceApi, StringComparison.Ordinal);
        Assert.Contains("app.api.getClassFamilyRelations(identity, campaignId)", workspace, StringComparison.Ordinal);
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
