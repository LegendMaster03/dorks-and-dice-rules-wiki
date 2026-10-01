namespace RulesWiki.Tests;

public sealed class Phase32UiAssetTests
{
    [Fact]
    public void ReferenceBrowserMovesLegacyContextControlsIntoTheIndex()
    {
        var content = ReadWebAsset("rules-reference-browser-enhancements.js");

        Assert.Contains("relocateBrowserContextControls", content, StringComparison.Ordinal);
        Assert.Contains("rules-wiki-browser-context-controls", content, StringComparison.Ordinal);
        Assert.Contains("index.insertBefore(controls, searchGroup)", content, StringComparison.Ordinal);
        Assert.Contains("wrapBrowserContextControl", content, StringComparison.Ordinal);
        Assert.Contains("rules-wiki-browser-context-label", content, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferenceBrowserPlacesContextControlsBeforeAsyncLoadCompletes()
    {
        var app = ReadWebAsset("app.js");
        var layout = ReadWebAsset("rules-reference-browser-layout.js");

        Assert.Contains("installImmediateReferenceBrowserLayout(app)", app, StringComparison.Ordinal);
        Assert.Contains("const rendering = renderActiveView(container);", layout, StringComparison.Ordinal);
        Assert.Contains("placeReferenceBrowserControls(container);", layout, StringComparison.Ordinal);
        Assert.Contains("await rendering;", layout, StringComparison.Ordinal);
        Assert.True(
            layout.IndexOf("placeReferenceBrowserControls(container);", StringComparison.Ordinal)
            < layout.IndexOf("await rendering;", StringComparison.Ordinal));
        Assert.Contains("index.insertBefore(controls, searchGroup)", layout, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferenceBrowserPrefetchesInitialReferenceContentDuringBootstrap()
    {
        var app = ReadWebAsset("app.js");
        var api = ReadWebAsset("rules-reference-api.js");

        Assert.Contains("prefetchInitialReferenceContent(api, hostContext);", app, StringComparison.Ordinal);
        Assert.True(
            app.IndexOf("prefetchInitialReferenceContent(api, hostContext);", StringComparison.Ordinal)
            < app.IndexOf("const [session, campaigns, workspaceScopes] = await Promise.all", StringComparison.Ordinal));
        Assert.Contains("prefetchGlobalRulesCatalog", api, StringComparison.Ordinal);
        Assert.Contains("prefetchCampaignRulesCatalog", api, StringComparison.Ordinal);
        Assert.Contains("prefetchWikiReferenceDetail", api, StringComparison.Ordinal);
        Assert.Contains("REFERENCE_PREFETCH_TTL_MS", api, StringComparison.Ordinal);
        Assert.Contains("consumePrefetch", api, StringComparison.Ordinal);
        Assert.Contains("!hasClientBrowserFilters(entityType, viewState.fieldFilters)", app, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferenceBrowserOwnsTheViewportAndScrollsBothPanesIndependently()
    {
        var content = ReadWebAssets(
            "rules-wiki-shell.css",
            "rules-reference-browser-phase1.css");

        Assert.Contains("height: 100dvh", content, StringComparison.Ordinal);
        Assert.Contains("overflow: hidden", content, StringComparison.Ordinal);
        Assert.Contains(".rules-core-library-index-list,", content, StringComparison.Ordinal);
        Assert.Contains(".rules-core-library-detail", content, StringComparison.Ordinal);
        Assert.Contains("overflow-y: auto", content, StringComparison.Ordinal);
        Assert.Contains("grid-template-rows: auto auto auto auto minmax(0, 1fr) auto", content, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferencePresentationReducesRepeatedAndSourceNativeNoise()
    {
        var script = ReadWebAsset("rules-reference-browser-enhancements.js");
        var styles = ReadWebAsset("rules-reference-browser-phase1.css");

        Assert.Contains("addReferenceHeading", script, StringComparison.Ordinal);
        Assert.Contains("collapseSourceSpecificMechanics", script, StringComparison.Ordinal);
        Assert.Contains("rules-wiki-source-mechanics-disclosure", script, StringComparison.Ordinal);
        Assert.Contains("Source-specific mechanics", script, StringComparison.Ordinal);
        Assert.Contains(".rules-core-library-row-override", styles, StringComparison.Ordinal);
        Assert.Contains("display: none", styles, StringComparison.Ordinal);
        Assert.Contains("flex-wrap: wrap", styles, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferencePresentationSeparatesRulesFromTechnicalMetadata()
    {
        var script = ReadWebAsset("rules-reference-browser-enhancements.js");

        Assert.Contains("compactReferenceContext", script, StringComparison.Ordinal);
        Assert.Contains("Source and reference metadata", script, StringComparison.Ordinal);
        Assert.Contains("Technical identifiers", script, StringComparison.Ordinal);
        Assert.Contains("compactCategoryHistory", script, StringComparison.Ordinal);
        Assert.Contains("uniqueCategories.size <= 1", script, StringComparison.Ordinal);
        Assert.Contains("Global scope", script, StringComparison.Ordinal);
        Assert.Contains("scopeBadge.remove()", script, StringComparison.Ordinal);
    }

    [Fact]
    public void MonsterPresentationConsumesImportMetadataAndRepairsSourceMarkup()
    {
        var script = ReadWebAsset("rules-reference-browser-enhancements.js");

        Assert.Contains("consumeAdditionalMonsterMechanics", script, StringComparison.Ordinal);
        Assert.Contains("SUPPRESSED_MONSTER_MECHANICS", script, StringComparison.Ordinal);
        Assert.Contains("actiontags", script, StringComparison.Ordinal);
        Assert.Contains("basicrules2024", script, StringComparison.Ordinal);
        Assert.Contains("referencesources", script, StringComparison.Ordinal);
        Assert.Contains("soundclip", script, StringComparison.Ordinal);
        Assert.Contains("presentPassivePerception", script, StringComparison.Ordinal);
        Assert.Contains("Passive Perception", script, StringComparison.Ordinal);
        Assert.Contains("Environment", script, StringComparison.Ordinal);
        Assert.Contains("Treasure", script, StringComparison.Ordinal);
        Assert.Contains("sanitizeMonsterGear", script, StringComparison.Ordinal);
        Assert.Contains("split(\"|\")[0]", script, StringComparison.Ordinal);
        Assert.Contains("normalizeRenderedRuleText", script, StringComparison.Ordinal);
        Assert.Contains("Melee Attack:", script, StringComparison.Ordinal);
        Assert.Contains("Ranged Attack:", script, StringComparison.Ordinal);
        Assert.Contains("acttrigger", script, StringComparison.Ordinal);
        Assert.Contains("actresponse", script, StringComparison.Ordinal);
        Assert.Contains("Hit:", script, StringComparison.Ordinal);
        Assert.Contains("Additional mechanics", script, StringComparison.Ordinal);
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
