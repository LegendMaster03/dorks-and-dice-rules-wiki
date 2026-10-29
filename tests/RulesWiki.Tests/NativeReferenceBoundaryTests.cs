using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RulesWiki.Web;

namespace RulesWiki.Tests;

public sealed class NativeReferenceBoundaryTests
{
    [Fact]
    public void DispatcherAllowsOnlyTheNativeReadContract()
    {
        Assert.Equal("/api/private/rulesets",
            RulesCoreUiOperationDispatcher.BuildRequest("getNativeRulesets", []).PathAndQuery);
        var args = JsonSerializer.Deserialize<JsonElement[]>(
            """["first-party-001",{"q":"blinded","category":"condition","limit":25,"offset":0}]""")!;
        var query = RulesCoreUiOperationDispatcher.BuildRequest("searchNativeRules", args);
        Assert.Equal(HttpMethod.Get, query.Method);
        Assert.Equal("/api/private/rulesets/first-party-001/rules?q=blinded&category=condition&limit=25&offset=0",
            query.PathAndQuery);
        Assert.Equal("/api/private/rulesets/first-party-001/rules/condition.blinded",
            RulesCoreUiOperationDispatcher.BuildRequest("getNativeRule",
                JsonSerializer.Deserialize<JsonElement[]>("""["first-party-001","condition.blinded"]""")!).PathAndQuery);
        foreach (var removed in new[] { "getWikiReferenceCatalog", "getWikiReferenceDetail",
                 "getWorkspaceScopes", "saveGlobalDecision", "compareRuleVersions" })
            Assert.Throws<KeyNotFoundException>(() => RulesCoreUiOperationDispatcher.BuildRequest(removed, []));
    }

    [Theory]
    [InlineData("""["first-party-001",{"arbitraryPath":"/api/source-admin/import"}]""")]
    [InlineData("""["first-party-001",{"limit":{}}]""")]
    [InlineData("""["first-party-001",{"q":null}]""")]
    public void DispatcherRejectsArbitraryPathAndInvalidFilters(string json)
    {
        Assert.Throws<InvalidDataException>(() => RulesCoreUiOperationDispatcher.BuildRequest(
            "searchNativeRules", JsonSerializer.Deserialize<JsonElement[]>(json)!));
    }

    [Fact]
    public async Task RealNamedOperationRequiresSiteAuthentication()
    {
        await using var factory = new RulesWikiWebApplicationFactory();
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/_rules-wiki/operations/getNativeRulesets",
            new { arguments = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AuthenticatedNamedOperationForwardsApprovedNativePayload()
    {
        await using var factory = new NativeWikiFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post,
            "/_rules-wiki/operations/getNativeRule");
        request.Headers.Add(ToolHostAuthenticationHeaders.Ticket, "site-issued-ticket");
        request.Headers.Add(ToolHostAuthenticationHeaders.IntrospectionPath,
            DorksAndDiceToolHostAuthenticationClient.ExpectedIntrospectionPath);
        request.Content = JsonContent.Create(new { arguments = new[] { "first-party-001", "condition.blinded" } });
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var native = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("condition.blinded", native.GetProperty("rule").GetProperty("id").GetString());
        Assert.Equal("Blinded", native.GetProperty("rule").GetProperty("name").GetString());
        Assert.Equal("condition", native.GetProperty("rule").GetProperty("kind").GetString());
        Assert.Equal("Cannot see", native.GetProperty("rule").GetProperty("definition")
            .GetProperty("description").GetString());
        Assert.Equal("no-store", response.Headers.CacheControl!.ToString());
    }

    private sealed class FakeSiteAuthentication : IToolHostAuthenticationClient
    {
        public Task<ToolHostAuthenticationContext?> RedeemAsync(string ticket, string path,
            CancellationToken cancellationToken = default) => Task.FromResult<ToolHostAuthenticationContext?>(new(
                1, "rules-wiki", "dorks-and-dice", new ToolHostUserContext("u-1", "User"), [], [])
            { ToolKey = "rules-wiki", PrivateTunnelCapability = "server-only" });
    }

    private sealed class FakePrivateCore : IRulesCorePrivateClient
    {
        public Task<HttpResponseMessage> SendAsync(ToolHostAuthenticationContext auth,
            RulesCorePrivateRequest request, CancellationToken cancellationToken = default)
        {
            Assert.Equal("server-only", auth.PrivateTunnelCapability);
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("/api/private/rulesets/first-party-001/rules/condition.blinded", request.PathAndQuery);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"rulesetId":"first-party-001","fingerprint":"fake","rule":{"id":"condition.blinded","name":"Blinded","kind":"condition","definition":{"description":"Cannot see"}}}""",
                    Encoding.UTF8, "application/json")
            });
        }
    }

    private sealed class NativeWikiFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("ToolHost:BaseUrl", "https://site.test");
            builder.UseSetting("RulesCorePrivate:BaseUrl", "https://core-private.test");
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IToolHostAuthenticationClient>();
                services.RemoveAll<IRulesCorePrivateClient>();
                services.AddSingleton<IToolHostAuthenticationClient, FakeSiteAuthentication>();
                services.AddSingleton<IRulesCorePrivateClient, FakePrivateCore>();
            });
        }
    }
    [Fact]
    public async Task PrivateClientRedeemsPairSpecificSiteTicketAndCallsCoreOnlyOverPrivateClient()
    {
        var siteCalls = 0;
        var coreCalls = 0;
        var site = new RecordingHandler(request =>
        {
            siteCalls++;
            Assert.Equal(RulesCorePrivateClient.TicketExchangePath, request.RequestUri!.AbsolutePath);
            Assert.Equal("server-only", request.Headers.Authorization?.Parameter);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new
                {
                    targetKey = "rules-core", ticket = "target-ticket",
                    introspectionPath = RulesCorePrivateClient.TargetIntrospectionPath
                })
            };
        });
        var core = new RecordingHandler(request =>
        {
            coreCalls++;
            Assert.Equal("https://core-private.test/api/private/rulesets", request.RequestUri!.ToString());
            Assert.Null(request.Headers.Authorization);
            Assert.Equal("target-ticket", Assert.Single(request.Headers.GetValues(ToolHostAuthenticationHeaders.Ticket)));
            Assert.Equal(RulesCorePrivateClient.TargetIntrospectionPath,
                Assert.Single(request.Headers.GetValues(ToolHostAuthenticationHeaders.IntrospectionPath)));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"rulesets":[]}""", Encoding.UTF8, "application/json")
            };
        });
        var client = new RulesCorePrivateClient(new FixedClientFactory(new Dictionary<string, HttpClient>
        {
            [RulesCorePrivateClient.ToolHostClientName] = new(site) { BaseAddress = new Uri("https://site.test") },
            [RulesCorePrivateClient.RulesCoreClientName] = new(core) { BaseAddress = new Uri("https://core-private.test") }
        }));
        using var response = await client.SendAsync(new ToolHostAuthenticationContext(
            1, "rules-wiki", "dorks-and-dice", new ToolHostUserContext("u", "User"), [], [])
            { ToolKey = "rules-wiki", PrivateTunnelCapability = "server-only" },
            new RulesCorePrivateRequest(HttpMethod.Get, "/api/private/rulesets"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, siteCalls);
        Assert.Equal(1, coreCalls);
    }

    [Fact]
    public async Task PrivateClientRejectsWrongTargetIntrospectionPathBeforeCoreRequest()
    {
        var site = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new
            {
                targetKey = "rules-core", ticket = "target-ticket",
                introspectionPath = "/tool-host/registrations/wrong/api/introspect"
            })
        });
        var client = new RulesCorePrivateClient(new FixedClientFactory(new Dictionary<string, HttpClient>
        {
            [RulesCorePrivateClient.ToolHostClientName] = new(site) { BaseAddress = new Uri("https://site.test") }
        }));
        await Assert.ThrowsAsync<RulesCorePrivateTunnelException>(() => client.SendAsync(
            new ToolHostAuthenticationContext(1, "rules-wiki", "dorks-and-dice",
                new ToolHostUserContext("u", "User"), [], [])
                { ToolKey = "rules-wiki", PrivateTunnelCapability = "server-only" },
            new RulesCorePrivateRequest(HttpMethod.Get, "/api/private/rulesets")));
    }

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) =>
            Task.FromResult(handler(request));
    }

    private sealed class FixedClientFactory(IReadOnlyDictionary<string, HttpClient> clients) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => clients[name];
    }

}
