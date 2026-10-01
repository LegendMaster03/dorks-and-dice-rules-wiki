using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace RulesWiki.Tests;

internal sealed class RulesWikiWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ToolHost:BaseUrl", "http://site.example.invalid");
        builder.UseSetting("RulesCorePrivate:BaseUrl", "http://rules-core-private.example.invalid");
    }
}
