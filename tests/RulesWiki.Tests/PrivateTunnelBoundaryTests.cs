using System.Net;
using System.Text;
using System.Text.Json;
using RulesWiki.Web;

namespace RulesWiki.Tests;

public sealed class PrivateTunnelBoundaryTests
{
    [Fact]
    public async Task IntrospectionCapturesServerOnlyPrivateTunnelCapability()
    {
        var handler = new RecordingHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent(new
                {
                    contractVersion = 1,
                    toolKey = "rules-wiki",
                    toolSlug = "rules-wiki",
                    siteMode = "dorks-and-dice",
                    user = new { id = "user-1", displayName = "User" },
                    globalRoles = new[] { "Global Editor" },
                    campaigns = Array.Empty<object>()
                })
            };
            response.Headers.Add(ToolHostAuthenticationHeaders.PrivateTunnelCapability, "private-capability-1");
            return response;
        });
        var client = new DorksAndDiceToolHostAuthenticationClient(new HttpClient(handler)
        {
            BaseAddress = new Uri("https://site.test")
        });

        var context = await client.RedeemAsync("ticket-1", DorksAndDiceToolHostAuthenticationClient.ExpectedIntrospectionPath);

        Assert.NotNull(context);
        Assert.Equal("private-capability-1", context!.PrivateTunnelCapability);
        Assert.Equal("rules-wiki", context.ToolKey);
        Assert.Equal("Bearer", handler.LastRequest!.Headers.Authorization!.Scheme);
        Assert.Equal("ticket-1", handler.LastRequest.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task PrivateClientExchangesCapabilityThenCallsRulesCoreDirectly()
    {
        var siteHandler = new RecordingHandler(request =>
        {
            Assert.Equal(RulesCorePrivateClient.TicketExchangePath, request.RequestUri!.AbsolutePath);
            Assert.Equal("private-capability-1", request.Headers.Authorization!.Parameter);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent(new
                {
                    targetKey = "rules-core",
                    ticket = "rules-core-ticket",
                    introspectionPath = "/tool-host/registrations/rules-core/api/introspect"
                })
            };
        });
        var coreHandler = new RecordingHandler(request =>
        {
            Assert.Equal("https://core-private.test/api/wiki/references?limit=10", request.RequestUri!.ToString());
            Assert.Null(request.Headers.Authorization);
            Assert.Equal("rules-core-ticket", Assert.Single(request.Headers.GetValues(ToolHostAuthenticationHeaders.Ticket)));
            Assert.Equal(
                "/tool-host/registrations/rules-core/api/introspect",
                Assert.Single(request.Headers.GetValues(ToolHostAuthenticationHeaders.IntrospectionPath)));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"ok\":true}", Encoding.UTF8, "application/json")
            };
        });
        var factory = new FixedHttpClientFactory(new Dictionary<string, HttpClient>
        {
            [RulesCorePrivateClient.ToolHostClientName] = new(siteHandler) { BaseAddress = new Uri("https://site.test") },
            [RulesCorePrivateClient.RulesCoreClientName] = new(coreHandler) { BaseAddress = new Uri("https://core-private.test") }
        });
        var client = new RulesCorePrivateClient(factory);

        using var response = await client.SendAsync(
            AuthContext(),
            new RulesCorePrivateRequest(HttpMethod.Get, "/api/wiki/references?limit=10"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, siteHandler.CallCount);
        Assert.Equal(1, coreHandler.CallCount);
    }

    [Fact]
    public async Task PrivateClientFailsClosedWithoutPrivateTunnelCapability()
    {
        var factory = new FixedHttpClientFactory(new Dictionary<string, HttpClient>());
        var client = new RulesCorePrivateClient(factory);

        var exception = await Assert.ThrowsAsync<RulesCorePrivateTunnelException>(() => client.SendAsync(
            AuthContext() with { PrivateTunnelCapability = null },
            new RulesCorePrivateRequest(HttpMethod.Get, "/api/wiki/references")));

        Assert.Equal(503, exception.StatusCode);
    }

    [Fact]
    public void UiOperationCatalogDoesNotExposePublicConsumerApiOperations()
    {
        Assert.Throws<KeyNotFoundException>(() =>
            RulesCoreUiOperationDispatcher.BuildRequest("getGlobalRulesCatalog", []));
        Assert.Throws<KeyNotFoundException>(() =>
            RulesCoreUiOperationDispatcher.BuildRequest("getGlobalResolvedRule", []));
        Assert.Throws<KeyNotFoundException>(() =>
            RulesCoreUiOperationDispatcher.BuildRequest("compareRuleVersions", []));
    }

    [Fact]
    public void UiOperationCatalogMapsWikiReferenceBrowseToPrivateContract()
    {
        var arguments = JsonSerializer.Deserialize<JsonElement[]>("[null,{\"entityType\":\"class\",\"limit\":\"25\"}]")!;

        var request = RulesCoreUiOperationDispatcher.BuildRequest("getWikiReferenceCatalog", arguments);

        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("/api/wiki/references?entityType=class&limit=25", request.PathAndQuery);
    }

    private static ToolHostAuthenticationContext AuthContext() => new(
        1,
        "rules-wiki",
        "dorks-and-dice",
        new ToolHostUserContext("user-1", "User"),
        ["Global Editor"],
        [])
    {
        ToolKey = "rules-wiki",
        PrivateTunnelCapability = "private-capability-1"
    };

    private static StringContent JsonContent(object value) =>
        new(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json");

    private sealed class FixedHttpClientFactory(IReadOnlyDictionary<string, HttpClient> clients) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            clients.TryGetValue(name, out var client)
                ? client
                : throw new Xunit.Sdk.XunitException($"Unexpected HttpClient '{name}'.");
    }

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            CallCount += 1;
            return Task.FromResult(responder(request));
        }
    }
}
