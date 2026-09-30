using System.Net.Http.Headers;

namespace RulesWiki.Web;

public sealed class RulesCoreDelegationProxy(HttpClient httpClient)
{
    public const string TargetToolSlug = "rules-core";
    private static readonly HashSet<string> HopByHopHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "TE",
        "Trailer", "Transfer-Encoding", "Upgrade"
    };

    public async Task ForwardAsync(HttpContext context, string corePath)
    {
        if (!RulesCoreInternalRouteMapper.IsPrivateCoreTarget(corePath))
        {
            throw new ArgumentException("Rules Wiki delegation target must use the private Rules Core contract.", nameof(corePath));
        }

        var authentication = HostedToolAuthenticationMiddleware.GetAuthenticationContext(context);
        if (authentication is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }
        if (string.IsNullOrWhiteSpace(authentication.DelegationCapability)
            || string.IsNullOrWhiteSpace(authentication.DelegationPath))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new { error = "Rules Wiki is not configured to delegate to Rules Core." }, context.RequestAborted);
            return;
        }
        if (httpClient.BaseAddress is null)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return;
        }

        var delegationBase = authentication.DelegationPath.Replace("{targetSlug}", TargetToolSlug, StringComparison.Ordinal);
        var requestUri = $"{delegationBase}{corePath}{context.Request.QueryString}";
        using var outbound = new HttpRequestMessage(new HttpMethod(context.Request.Method), requestUri);
        outbound.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authentication.DelegationCapability);

        if (RequestCanHaveBody(context.Request))
            outbound.Content = new StreamContent(context.Request.Body);

        foreach (var header in context.Request.Headers)
        {
            if (ShouldStripRequestHeader(header.Key)) continue;
            if (!outbound.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()) && outbound.Content is not null)
                outbound.Content.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
        }

        HttpResponseMessage upstream;
        try
        {
            upstream = await httpClient.SendAsync(outbound, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
        }
        catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = StatusCodes.Status504GatewayTimeout;
            return;
        }
        catch (HttpRequestException)
        {
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            return;
        }

        using (upstream)
        {
            context.Response.StatusCode = (int)upstream.StatusCode;
            CopyResponseHeaders(upstream.Headers, context.Response.Headers);
            CopyResponseHeaders(upstream.Content.Headers, context.Response.Headers);
            context.Response.Headers.Remove("transfer-encoding");
            await upstream.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
    }

    private static bool RequestCanHaveBody(HttpRequest request) =>
        request.ContentLength is > 0 || request.Headers.ContainsKey("Transfer-Encoding");

    private static bool ShouldStripRequestHeader(string name) =>
        string.Equals(name, "Host", StringComparison.OrdinalIgnoreCase)
        || string.Equals(name, "Authorization", StringComparison.OrdinalIgnoreCase)
        || string.Equals(name, "Cookie", StringComparison.OrdinalIgnoreCase)
        || string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase)
        || HopByHopHeaders.Contains(name)
        || name.StartsWith("X-Dorks-Tool-", StringComparison.OrdinalIgnoreCase);

    private static void CopyResponseHeaders(HttpHeaders source, IHeaderDictionary destination)
    {
        foreach (var header in source)
        {
            if (HopByHopHeaders.Contains(header.Key)
                || header.Key.StartsWith("X-Dorks-Tool-", StringComparison.OrdinalIgnoreCase))
                continue;
            destination[header.Key] = header.Value.ToArray();
        }
    }
}
