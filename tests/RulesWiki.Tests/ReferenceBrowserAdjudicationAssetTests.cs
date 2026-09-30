namespace RulesWiki.Tests;

public sealed class ReferenceBrowserAdjudicationAssetTests
{
    [Fact]
    public void ReferenceDetailUsesRealConceptTargetsAndRealSourceNormalizationTargets()
    {
        var detail = ReadWebAsset("rules-browser-detail.js");
        var api = ReadWebAsset("rules-reference-api.js");
        var app = ReadWebAsset("app.js");

        Assert.Contains("Edit Dorks & Dice rule", detail, StringComparison.Ordinal);
        Assert.Contains("Edit campaign rule", detail, StringComparison.Ordinal);
        Assert.Contains("app.canEditGlobal", detail, StringComparison.Ordinal);
        Assert.Contains("app.dmCampaigns", detail, StringComparison.Ordinal);
        Assert.Contains("if (!ruleConceptId) return null", detail, StringComparison.Ordinal);
        Assert.Contains("reference.ruleConceptId", detail, StringComparison.Ordinal);

        Assert.Contains("Create/bind Dorks & Dice rule", detail, StringComparison.Ordinal);
        Assert.Contains("referenceNormalizationTarget", detail, StringComparison.Ordinal);
        Assert.Contains("reference?.effectiveVariation?.sourceEntityId", detail, StringComparison.Ordinal);
        Assert.Contains("app.api.acceptSourceNormalization(sourceEntityId)", detail, StringComparison.Ordinal);
        Assert.Contains("openReferenceAdjudication(app, ruleConceptId, null)", detail, StringComparison.Ordinal);

        Assert.Contains("ruleConceptId: reference.ruleConceptId ?? null", api, StringComparison.Ordinal);
        Assert.DoesNotContain("ruleConceptId: reference.referenceIdentity", api, StringComparison.Ordinal);
        Assert.Contains("reference.browseVariation ?? reference.effectiveVariation", api, StringComparison.Ordinal);
        Assert.DoesNotContain("nativeEntityType", detail, StringComparison.Ordinal);
        Assert.DoesNotContain("Source-native category", detail, StringComparison.Ordinal);

        Assert.Contains("/api/workspace/scopes", app, StringComparison.Ordinal);
        Assert.Contains("scope.canAdjudicate === true", app, StringComparison.Ordinal);
        Assert.Contains("installWikiReferenceApi(api)", app, StringComparison.Ordinal);
        Assert.Contains("installWikiReferenceBrowserEnhancements(app)", app, StringComparison.Ordinal);
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
