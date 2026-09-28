using System.Net;

namespace RulesWiki.Tests;

public sealed class SourceImportNotificationAssetTests
{
    [Fact]
    public async Task SourceAddAssetExplainsImportStateAndSupportsDismissal()
    {
        await using var factory = new RulesWikiWebApplicationFactory();
        using var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var response = await client.GetAsync("/source-add.js");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(
            "javascript",
            response.Content.Headers.ContentType?.MediaType ?? string.Empty,
            StringComparison.OrdinalIgnoreCase);

        var source = await response.Content.ReadAsStringAsync();
        Assert.Contains("Import complete", source, StringComparison.Ordinal);
        Assert.Contains("Dismiss finished", source, StringComparison.Ordinal);
        Assert.Contains("Dismiss notification", source, StringComparison.Ordinal);
        Assert.Contains("Dismiss hides finished notifications only", source, StringComparison.Ordinal);
        Assert.Contains("does not cancel imports", source, StringComparison.Ordinal);
        Assert.Contains("Last update", source, StringComparison.Ordinal);
        Assert.Contains("dismissCurrentUserSourceImportJobs", source, StringComparison.Ordinal);
        Assert.DoesNotContain("window.localStorage", source, StringComparison.Ordinal);
    }
}
