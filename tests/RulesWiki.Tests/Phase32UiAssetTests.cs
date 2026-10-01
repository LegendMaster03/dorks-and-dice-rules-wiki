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
