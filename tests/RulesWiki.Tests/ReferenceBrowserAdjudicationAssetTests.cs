namespace RulesWiki.Tests;

public sealed class ReferenceBrowserAdjudicationAssetTests
{
    [Fact]
    public void ReferenceDetailRestoresAuthorizedAdjudicationWithoutFabricatingSourceOnlyTargets()
    {
        var detail = ReadWebAsset("rules-browser-detail.js");
        var api = ReadWebAsset("rules-reference-api.js");

        Assert.Contains("Edit Dorks & Dice rule", detail, StringComparison.Ordinal);
        Assert.Contains("Edit campaign rule", detail, StringComparison.Ordinal);
        Assert.Contains("app.canEditGlobal", detail, StringComparison.Ordinal);
        Assert.Contains("app.dmCampaigns", detail, StringComparison.Ordinal);
        Assert.Contains("if (!ruleConceptId) return null", detail, StringComparison.Ordinal);
        Assert.Contains("reference.ruleConceptId", detail, StringComparison.Ordinal);

        Assert.Contains("ruleConceptId: reference.ruleConceptId ?? null", api, StringComparison.Ordinal);
        Assert.DoesNotContain("ruleConceptId: reference.referenceIdentity", api, StringComparison.Ordinal);
        Assert.DoesNotContain("nativeEntityType", detail, StringComparison.Ordinal);
        Assert.DoesNotContain("Source-native category", detail, StringComparison.Ordinal);
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
