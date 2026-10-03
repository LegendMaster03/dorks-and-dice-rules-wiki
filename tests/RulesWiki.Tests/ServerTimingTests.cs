using System.Net;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using RulesWiki.Web;

namespace RulesWiki.Tests;

public sealed class ServerTimingTests
{
    [Fact]
    public async Task HostedResponseEmitsWholeRequestAndAuthenticationTiming()
    {
        var authenticationContext = AuthContext();
        using var server = new TestServer(new WebHostBuilder().Configure(app =>
        {
            app.Run(context =>
            {
                var middleware = new HostedToolAuthenticationMiddleware(
                    nextContext => nextContext.Response.WriteAsync("ok"));
                return middleware.InvokeAsync(
                    context,
                    new StaticAuthenticationClient(authenticationContext));
            });
        }));
        using var client = server.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/");
        request.Headers.Add(ToolHostAuthenticationHeaders.Ticket, "source-tool-ticket");
        request.Headers.Add(
            ToolHostAuthenticationHeaders.IntrospectionPath,
            DorksAndDiceToolHostAuthenticationClient.ExpectedIntrospectionPath);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var timing = string.Join(
            ", ",
            response.Headers.GetValues(RulesWikiServerTiming.HeaderName));
        Assert.Contains("rules-wiki-auth;dur=", timing, StringComparison.Ordinal);
        Assert.Contains("rules-wiki;dur=", timing, StringComparison.Ordinal);
        Assert.DoesNotContain("platform-", timing, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PrivateRulesCoreCallEmitsDependencyTimingAndPropagatesOnlyCoreMetrics()
    {
        var siteHandler = new RecordingHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent(new
                {
                    targetKey = "rules-core",
                    ticket = "rules-core-ticket",
                    introspectionPath = "/tool-host/registrations/rules-core/api/introspect"
                })
            });
        var coreHandler = new RecordingHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"ok\":true}", Encoding.UTF8, "application/json")
            };
            response.Headers.TryAddWithoutValidation(
                RulesWikiServerTiming.HeaderName,
                "rules-core-auth;dur=1.2, platform-site;dur=9.9, rules-core;dur=2.4");
            return response;
        });
        var factory = new FixedHttpClientFactory(new Dictionary<string, HttpClient>
        {
            [RulesCorePrivateClient.ToolHostClientName] = new(siteHandler)
            {
                BaseAddress = new Uri("https://site.test")
            },
            [RulesCorePrivateClient.RulesCoreClientName] = new(coreHandler)
            {
                BaseAddress = new Uri("https://core-private.test")
            }
        });
        var httpContext = new DefaultHttpContext();
        var client = new RulesCorePrivateClient(
            factory,
            new HttpContextAccessor { HttpContext = httpContext });

        using var response = await client.SendAsync(
            AuthContext(),
            new RulesCorePrivateRequest(HttpMethod.Get, "/api/wiki/references?limit=10"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var timing = string.Join(
            ", ",
            httpContext.Response.Headers[RulesWikiServerTiming.HeaderName].ToArray());
        Assert.Contains(
            "rules-wiki-rules-core;desc=\"reference:ok\";dur=",
            timing,
            StringComparison.Ordinal);
        Assert.Contains("rules-core-auth;dur=1.2", timing, StringComparison.Ordinal);
        Assert.Contains("rules-core;dur=2.4", timing, StringComparison.Ordinal);
        Assert.DoesNotContain("platform-site", timing, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MissingPrivateCapabilityIsVisibleWithoutCallingEitherDependency()
    {
        var siteHandler = new RecordingHandler(_ =>
            throw new InvalidOperationException("Ticket exchange must not run."));
        var coreHandler = new RecordingHandler(_ =>
            throw new InvalidOperationException("Rules Core must not run."));
        var factory = new FixedHttpClientFactory(new Dictionary<string, HttpClient>
        {
            [RulesCorePrivateClient.ToolHostClientName] = new(siteHandler)
            {
                BaseAddress = new Uri("https://site.test")
            },
            [RulesCorePrivateClient.RulesCoreClientName] = new(coreHandler)
            {
                BaseAddress = new Uri("https://core-private.test")
            }
        });
        var httpContext = new DefaultHttpContext();
        var client = new RulesCorePrivateClient(
            factory,
            new HttpContextAccessor { HttpContext = httpContext });

        var exception = await Assert.ThrowsAsync<RulesCorePrivateTunnelException>(() =>
            client.SendAsync(
                AuthContext() with { PrivateTunnelCapability = null },
                new RulesCorePrivateRequest(HttpMethod.Get, "/api/wiki/references")));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, exception.StatusCode);
        Assert.Equal(0, siteHandler.CallCount);
        Assert.Equal(0, coreHandler.CallCount);
        var timing = string.Join(
            ", ",
            httpContext.Response.Headers[RulesWikiServerTiming.HeaderName].ToArray());
        Assert.Contains(
            "rules-wiki-rules-core;desc=\"reference:capability-unavailable\";dur=",
            timing,
            StringComparison.Ordinal);
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
        new(System.Text.Json.JsonSerializer.Serialize(value), Encoding.UTF8, "application/json");

    private sealed class StaticAuthenticationClient(ToolHostAuthenticationContext context)
        : IToolHostAuthenticationClient
    {
        public Task<ToolHostAuthenticationContext?> RedeemAsync(
            string ticket,
            string introspectionPath,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<ToolHostAuthenticationContext?>(context);
    }

    private sealed class FixedHttpClientFactory(IReadOnlyDictionary<string, HttpClient> clients)
        : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            clients.TryGetValue(name, out var client)
                ? client
                : throw new Xunit.Sdk.XunitException($"Unexpected HttpClient '{name}'.");
    }

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        : HttpMessageHandler
    {
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount += 1;
            return Task.FromResult(responder(request));
        }
    }
}
