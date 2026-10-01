namespace RulesWiki.Tests;

public sealed class Phase32CompanionContentAssetTests
{
    [Fact]
    public void CompanionContentUsesExplicitPrivateOperationAndCorePrivateIngress()
    {
        var program = ReadRepositoryFile("src", "RulesWiki.Web", "Program.cs");
        var operation = ReadRepositoryFile("src", "RulesWiki.Web", "RulesCoreCompanionContentOperation.cs");

        Assert.Contains("/_rules-wiki/operations/getWikiReferenceCompanionContent", program, StringComparison.Ordinal);
        Assert.Contains("RulesCoreCompanionContentOperation", program, StringComparison.Ordinal);
        Assert.Contains("/companion-content", operation, StringComparison.Ordinal);
        Assert.Contains("rulesCore.SendAsync", operation, StringComparison.Ordinal);
        Assert.DoesNotContain("RulesCorePrivate:BaseUrl", operation, StringComparison.Ordinal);
    }

    [Fact]
    public void ReferencePresentationInstallsCompanionFluffAfterPrimaryBrowserEnhancements()
    {
        var app = ReadWebAsset("app.js");

        Assert.Contains("installWikiReferenceCompanionContent", app, StringComparison.Ordinal);
        Assert.True(
            app.IndexOf("installWikiReferenceBrowserEnhancements(app);", StringComparison.Ordinal)
            < app.IndexOf("installWikiReferenceCompanionContent(app);", StringComparison.Ordinal));
    }

    [Fact]
    public void CompanionFluffIsScopedToTheActiveSourceVariationAndRenderedAsDescription()
    {
        var script = ReadWebAsset("rules-reference-companion-content.js");

        Assert.Contains("getWikiReferenceCompanionContent", script, StringComparison.Ordinal);
        Assert.Contains("sourceEntityRevisionId", script, StringComparison.Ordinal);
        Assert.Contains("sourceEntityId", script, StringComparison.Ordinal);
        Assert.Contains("monsterfluff", script, StringComparison.Ordinal);
        Assert.Contains("racefluff", script, StringComparison.Ordinal);
        Assert.Contains("spellfluff", script, StringComparison.Ordinal);
        Assert.Contains("text: \"Description\"", script, StringComparison.Ordinal);
        Assert.Contains("content?.content?.entries", script, StringComparison.Ordinal);
        Assert.Contains("renderNamedRuleEntry", script, StringComparison.Ordinal);
        Assert.DoesNotContain("content?.content?.images", script, StringComparison.Ordinal);
    }

    [Fact]
    public void CompanionLoadingDoesNotBlockPrimaryReferenceDetail()
    {
        var script = ReadWebAsset("rules-reference-companion-content.js");

        Assert.Contains("presentRenderedFragment", script, StringComparison.Ordinal);
        Assert.Contains("void presentCompanionContent", script, StringComparison.Ordinal);
        Assert.Contains("Companion content is supplementary", script, StringComparison.Ordinal);
        Assert.Contains("companionCache", script, StringComparison.Ordinal);
    }

    private static string ReadWebAsset(string filename) =>
        ReadRepositoryFile("src", "RulesWiki.Web", "wwwroot", filename);

    private static string ReadRepositoryFile(params string[] segments)
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

        var pathSegments = new[] { directory.FullName }.Concat(segments).ToArray();
        return File.ReadAllText(Path.Combine(pathSegments));
    }
}
