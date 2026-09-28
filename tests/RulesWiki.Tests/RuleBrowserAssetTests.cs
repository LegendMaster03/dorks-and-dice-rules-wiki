namespace RulesWiki.Tests;

public sealed class RuleBrowserAssetTests
{
    [Fact]
    public void BrowserConsumesToolRelativeRoutingContract()
    {
        var content = ReadWebAssets(
            "rules-browser.js",
            "rules-browser-index.js",
            "rules-browser-detail.js",
            "rules-browser-routing.js");

        Assert.Contains("toolRoute", content, StringComparison.Ordinal);
        Assert.Contains("toolBasePath", content, StringComparison.Ordinal);
        Assert.Contains("browserLink", content, StringComparison.Ordinal);
        Assert.Contains("/tools/rules-wiki", content, StringComparison.Ordinal);
        Assert.DoesNotContain("/tools/rules-core", content, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserPersistsRecoverableSearchAndSortState()
    {
        var content = ReadWebAssets(
            "rules-browser.js",
            "rules-browser-index.js",
            "rules-browser-routing.js");

        Assert.Contains("parseBrowserViewStateFromLocation", content, StringComparison.Ordinal);
        Assert.Contains("parameters.set(\"q\"", content, StringComparison.Ordinal);
        Assert.Contains("parameters.set(\"sort\"", content, StringComparison.Ordinal);
        Assert.Contains("replaceToolRoute", content, StringComparison.Ordinal);
        Assert.Contains("normalizeBrowserSort", content, StringComparison.Ordinal);
        Assert.Contains("sortRulesForBrowser", content, StringComparison.Ordinal);
        Assert.Contains("canSortBrowserDataset", content, StringComparison.Ordinal);
        Assert.Contains("Load all results before sorting", content, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserUsesContainerAwareDrillInAndAccessibleSelection()
    {
        var content = ReadWebAssets(
            "rules-browser.js",
            "rules-browser-index.js",
            "rules-reference-browser-phase1.css");

        Assert.Contains("container-type: inline-size", content, StringComparison.Ordinal);
        Assert.Contains("@container rules-wiki-browser (max-width: 900px)", content, StringComparison.Ordinal);
        Assert.Contains("getBoundingClientRect", content, StringComparison.Ordinal);
        Assert.Contains("isCompactRulesBrowserWidth", content, StringComparison.Ordinal);
        Assert.Contains("aria-selected", content, StringComparison.Ordinal);
        Assert.Contains("aria-sort", content, StringComparison.Ordinal);
        Assert.Contains("arrowdown", content, StringComparison.Ordinal);
        Assert.Contains("arrowup", content, StringComparison.Ordinal);
        Assert.Contains("escape", content, StringComparison.Ordinal);
        Assert.Contains("focus-visible", content, StringComparison.Ordinal);
    }

    [Fact]
    public void BrowserProtectsIncrementalAndDetailRequestsFromStaleResults()
    {
        var content = ReadWebAsset("rules-browser.js");

        Assert.Contains("serial !== loadSerial", content, StringComparison.Ordinal);
        Assert.Contains("detailSerial", content, StringComparison.Ordinal);
        Assert.Contains("currentRules.length < totalCount", content, StringComparison.Ordinal);
        Assert.Contains("loadMore", content, StringComparison.Ordinal);
        Assert.Contains("keepSelection: true", content, StringComparison.Ordinal);
    }

    [Fact]
    public void SourceLibraryConsumesStableEntityRoutingContract()
    {
        var content = ReadWebAsset("source-library.js");

        Assert.Contains("/sources/", content, StringComparison.Ordinal);
        Assert.Contains("parseSourceEntityRoute", content, StringComparison.Ordinal);
        Assert.Contains("libraryDeepLink", content, StringComparison.Ordinal);
        Assert.Contains("popstate", content, StringComparison.Ordinal);
    }

    [Fact]
    public void RulesLawyerWorkspaceUsesAddressableHostedRoute()
    {
        var content = ReadWebAsset("workspace-routing.js");

        Assert.Contains("/adjudication/rules-lawyer", content, StringComparison.Ordinal);
        Assert.Contains("viewNavigation.global", content, StringComparison.Ordinal);
        Assert.Contains("toolBasePath", content, StringComparison.Ordinal);
        Assert.Contains("popstate", content, StringComparison.Ordinal);
        Assert.Contains("canEditGlobal", content, StringComparison.Ordinal);
    }

    [Fact]
    public void PublishedCatalogEmptyStatesKeepSourceAndPublicationLayersDistinct()
    {
        var content = ReadWebAsset("rules-browser.js");

        Assert.Contains("resolvePublishedEmptyState", content, StringComparison.Ordinal);
        Assert.Contains("No published", content, StringComparison.Ordinal);
        Assert.Contains("source material exists in the Source Library", content, StringComparison.Ordinal);
        Assert.Contains("it is not part of the published rules", content, StringComparison.Ordinal);
        Assert.Contains("Published rules remain separate from source material", content, StringComparison.Ordinal);
        Assert.Contains("Open Source Library", content, StringComparison.Ordinal);
    }

    [Fact]
    public void SourceRecordsExposeReadableAndRawRepresentations()
    {
        var content = ReadWebAsset("source-library.js");

        Assert.Contains("Readable content", content, StringComparison.Ordinal);
        Assert.Contains("Readable source-native content", content, StringComparison.Ordinal);
        Assert.Contains("renderReadableSourceValue", content, StringComparison.Ordinal);
        Assert.Contains("Raw source-native data (advanced)", content, StringComparison.Ordinal);
        Assert.Contains("Raw Rules Core mechanical data (advanced)", content, StringComparison.Ordinal);
    }

    [Fact]
    public void AdjudicationQueueSeparatesObservationFromDiscovery()
    {
        var content = ReadWebAsset("adjudication-queue.js");

        Assert.Contains("Run deterministic discovery", content, StringComparison.Ordinal);
        Assert.Contains("Loading existing adjudication work", content, StringComparison.Ordinal);
        Assert.Contains("No discovery was run", content, StringComparison.Ordinal);
        Assert.Contains("does not run discovery or create new work", content, StringComparison.Ordinal);
        Assert.Contains("may reconcile existing work", content, StringComparison.Ordinal);
        Assert.Contains("Discovery completed", content, StringComparison.Ordinal);
        Assert.Contains("Discovery failed", content, StringComparison.Ordinal);
        Assert.Contains("card.refresh = loadQueue", content, StringComparison.Ordinal);
        Assert.Contains("discover.addEventListener", content, StringComparison.Ordinal);
        Assert.DoesNotContain("Running deterministic discovery and loading adjudication work", content, StringComparison.Ordinal);
    }

    [Fact]
    public void RulesBrowserInternalScrollChainingPreservesOrientation()
    {
        var content = ReadWebAssets("rules-core.css", "rules-reference-browser-phase1.css");

        Assert.Contains("scrollbar-gutter: stable", content, StringComparison.Ordinal);
        Assert.Contains("overscroll-behavior: auto", content, StringComparison.Ordinal);
        Assert.Contains("scroll-padding-top: 3rem", content, StringComparison.Ordinal);
    }

    [Fact]
    public void MonsterRendererIsRegisteredAsSpecializedRuleRenderer()
    {
        var content = ReadWebAssets(
            "rule-renderers.js",
            "rule-renderer-support.js",
            "rule-renderers-specialized.js");

        Assert.Contains("[\"monster\", renderMonster]", content, StringComparison.Ordinal);
        Assert.Contains("Legendary Actions", content, StringComparison.Ordinal);
        Assert.Contains("Ability Scores", content, StringComparison.Ordinal);
        Assert.Contains("abilityDatum(\"Save\"", content, StringComparison.Ordinal);
        Assert.Contains("hasAbilitySaveModel", content, StringComparison.Ordinal);
    }

    private static string ReadWebAssets(params string[] filenames) =>
        string.Join(
            Environment.NewLine,
            filenames.Select(ReadWebAsset));

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

        var path = Path.Combine(directory.FullName, "src", "RulesWiki.Web", "wwwroot", filename);
        return File.ReadAllText(path);
    }
}
