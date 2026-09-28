using System.Net;

namespace RulesWiki.Tests;

public sealed class HostLayoutAssetTests
{
    [Fact]
    public async Task RulesWikiRequestsFullBleedHostLayout()
    {
        await using var factory = new RulesWikiWebApplicationFactory();
        using var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        using var response = await client.GetAsync("/app.js");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var app = await response.Content.ReadAsStringAsync();

        Assert.Contains("dorksAndDiceToolHost", app, StringComparison.Ordinal);
        Assert.Contains("setContentLayout?.(\"full-bleed\")", app, StringComparison.Ordinal);
    }
}
