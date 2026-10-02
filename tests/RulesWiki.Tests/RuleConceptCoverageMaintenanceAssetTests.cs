using System.Net;

namespace RulesWiki.Tests;

public sealed class RuleConceptCoverageMaintenanceAssetTests
{
    [Fact]
    public async Task SourceAdminAssetExposesOwnerRuleConceptCoverageRepair()
    {
        await using var factory = new RulesWikiWebApplicationFactory();
        using var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var response = await client.GetAsync("/corpus-reconciliation-maintenance.js");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var source = await response.Content.ReadAsStringAsync();
        Assert.Contains("Rules Layer concept coverage", source, StringComparison.Ordinal);
        Assert.Contains("Repair RuleConcept coverage", source, StringComparison.Ordinal);
        Assert.Contains("getRuleConceptCoverageStatus", source, StringComparison.Ordinal);
        Assert.Contains("startRuleConceptCoverageRepair", source, StringComparison.Ordinal);
        Assert.Contains("Existing concept-backed histories are not merged or rewritten", source, StringComparison.Ordinal);
        Assert.Contains("Run coverage repair again", source, StringComparison.Ordinal);
    }
}
