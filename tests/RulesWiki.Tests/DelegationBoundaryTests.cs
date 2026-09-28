using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using RulesWiki.Web;

namespace RulesWiki.Tests;

public sealed class DelegationBoundaryTests
{
    [Fact]
    public async Task IntrospectionCapturesServerOnlyDelegationCapability()
    {
        var handler = new RecordingHandler(_ =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new
                {
                    contractVersion = 1,
                    toolSlug = "rules-wiki",
                    siteMode = "dorks-and-dice",
                    user = new { id = "user-1", displayName = "User" },
                    globalRoles = new[] { "Global Editor" },
                    campaigns = Array.Empty<object>()
                }), Encoding.UTF8, "application/json")
            };
            response.Headers.Add(ToolHostAuthenticationHeaders.DelegationCapability, "capability-1");
            response.Headers.Add(ToolHostAuthenticationHeaders.DelegationPath, DorksAndDiceToolHostAuthenticationClient.ExpectedDelegationPath);
            return response;
        });
        var client = new DorksAndDiceToolHostAuthenticationClient(new HttpClient(handler) { BaseAddress = new Uri("https://site.test") });

        var context = await client.RedeemAsync("ticket-1", DorksAndDiceToolHostAuthenticationClient.ExpectedIntrospectionPath);

        Assert.NotNull(context);
        Assert.Equal("capability-1", context!.DelegationCapability);
        Assert.Equal(DorksAndDiceToolHostAuthenticationClient.ExpectedDelegationPath, context.DelegationPath);
        Assert.Equal("Bearer", handler.LastRequest!.Headers.Authorization!.Scheme);
        Assert.Equal("ticket-1", handler.LastRequest.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task ProxyDelegatesApiRequestToRulesCoreWithoutLeakingDelegationHeaders()
    {
        var handler = new RecordingHandler(request =>
        {
            Assert.Equal("/tool-host/rules-wiki/api/delegate/rules-core/upstream/api/rules/monster.red-dragon?scope=global", request.RequestUri!.PathAndQuery);
            Assert.Equal("capability-1", request.Headers.Authorization!.Parameter);
            Assert.False(request.Headers.Contains(ToolHostAuthenticationHeaders.Ticket));
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"ok\":true}", Encoding.UTF8, "application/json") };
            response.Headers.Add(ToolHostAuthenticationHeaders.DelegationCapability, "must-not-leak");
            return response;
        });
        var proxy = new RulesCoreDelegationProxy(new HttpClient(handler) { BaseAddress = new Uri("https://site.test") });
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Method = "GET";
        httpContext.Request.Path = "/api/rules/monster.red-dragon";
        httpContext.Request.QueryString = new QueryString("?scope=global");
        httpContext.Request.Headers[ToolHostAuthenticationHeaders.Ticket] = "source-ticket";
        httpContext.Response.Body = new MemoryStream();
        HostedToolAuthenticationMiddleware.SetAuthenticationContext(httpContext, AuthContext());

        await proxy.ForwardAsync(httpContext);

        Assert.Equal(StatusCodes.Status200OK, httpContext.Response.StatusCode);
        Assert.False(httpContext.Response.Headers.ContainsKey(ToolHostAuthenticationHeaders.DelegationCapability));
        httpContext.Response.Body.Position = 0;
        Assert.Equal("{\"ok\":true}", await new StreamReader(httpContext.Response.Body).ReadToEndAsync());
    }

    [Fact]
    public async Task ProxyRequiresAuthenticatedDelegationContext()
    {
        var proxy = new RulesCoreDelegationProxy(new HttpClient(new RecordingHandler(_ => throw new Xunit.Sdk.XunitException("Upstream must not be called.")))
        { BaseAddress = new Uri("https://site.test") });
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = "/api/rules";

        await proxy.ForwardAsync(httpContext);

        Assert.Equal(StatusCodes.Status401Unauthorized, httpContext.Response.StatusCode);
    }

    [Fact]
    public async Task ProxyFailsClosedWhenRulesCoreIsNotAllowlisted()
    {
        var proxy = new RulesCoreDelegationProxy(new HttpClient(new RecordingHandler(_ => throw new Xunit.Sdk.XunitException("Upstream must not be called.")))
        { BaseAddress = new Uri("https://site.test") });
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = "/api/rules";
        httpContext.Response.Body = new MemoryStream();
        HostedToolAuthenticationMiddleware.SetAuthenticationContext(httpContext, AuthContext() with
        {
            DelegationCapability = null,
            DelegationPath = null
        });

        await proxy.ForwardAsync(httpContext);

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, httpContext.Response.StatusCode);
    }

    private static ToolHostAuthenticationContext AuthContext() => new(
        1,
        "rules-wiki",
        "dorks-and-dice",
        new ToolHostUserContext("user-1", "User"),
        ["Global Editor"],
        [])
    {
        DelegationCapability = "capability-1",
        DelegationPath = DorksAndDiceToolHostAuthenticationClient.ExpectedDelegationPath
    };

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(responder(request));
        }
    }
}
