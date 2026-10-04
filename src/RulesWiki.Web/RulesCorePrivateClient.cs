using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RulesWiki.Web;

public sealed record ToolPrivateTunnelTicketResponse(
    string TargetKey,
    string Ticket,
    string IntrospectionPath);

public sealed record RulesCorePrivateRequest(
    HttpMethod Method,
    string PathAndQuery,
    JsonElement? Body = null);

public sealed class RulesCorePrivateTunnelException(string message, int statusCode = StatusCodes.Status503ServiceUnavailable)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public interface IRulesCorePrivateClient
{
    Task<HttpResponseMessage> SendAsync(
        ToolHostAuthenticationContext authentication,
        RulesCorePrivateRequest request,
        CancellationToken cancellationToken = default);
}

public sealed class RulesCorePrivateClient(
    IHttpClientFactory httpClientFactory,
    IHttpContextAccessor? httpContextAccessor = null) : IRulesCorePrivateClient
{
    public const string ToolHostClientName = "rules-wiki-private-tunnel-control-plane";
    public const string RulesCoreClientName = "rules-core-private";
    public const string TargetToolKey = "rules-core";
    public const string TicketExchangePath = "/tool-host/rules-wiki/api/private-tunnel/rules-core/ticket";

    public async Task<HttpResponseMessage> SendAsync(
        ToolHostAuthenticationContext authentication,
        RulesCorePrivateRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(authentication);
        ArgumentNullException.ThrowIfNull(request);

        var timingContext = httpContextAccessor?.HttpContext;
        if (timingContext is not null)
        {
            RulesWikiServerTiming.EnsureRequestTiming(timingContext);
        }

        var dependencyTimer = Stopwatch.StartNew();
        var timingOperation = TimingOperationFor(request.PathAndQuery);
        var timingOutcome = "failed";

        try
        {
            if (string.IsNullOrWhiteSpace(authentication.PrivateTunnelCapability))
            {
                timingOutcome = "capability-unavailable";
                throw new RulesCorePrivateTunnelException(
                    "Rules Wiki did not receive a private-tunnel capability for Rules Core.");
            }

            var toolHostClient = httpClientFactory.CreateClient(ToolHostClientName);
            using var exchange = new HttpRequestMessage(HttpMethod.Post, TicketExchangePath);
            exchange.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                authentication.PrivateTunnelCapability);

            using var exchangeResponse = await toolHostClient.SendAsync(
                exchange,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            if (!exchangeResponse.IsSuccessStatusCode)
            {
                timingOutcome = $"ticket-http-{(int)exchangeResponse.StatusCode}";
                throw new RulesCorePrivateTunnelException(
                    $"Rules Core private ticket exchange failed with HTTP {(int)exchangeResponse.StatusCode}.");
            }

            var targetTicket = await exchangeResponse.Content.ReadFromJsonAsync<ToolPrivateTunnelTicketResponse>(
                cancellationToken: cancellationToken)
                ?? throw new RulesCorePrivateTunnelException("Rules Core private ticket exchange returned no ticket.");
            if (!string.Equals(targetTicket.TargetKey, TargetToolKey, StringComparison.Ordinal)
                || string.IsNullOrWhiteSpace(targetTicket.Ticket)
                || string.IsNullOrWhiteSpace(targetTicket.IntrospectionPath))
            {
                timingOutcome = "ticket-invalid";
                throw new RulesCorePrivateTunnelException("Rules Core private ticket exchange returned an invalid target credential.");
            }

            var rulesCoreClient = httpClientFactory.CreateClient(RulesCoreClientName);
            using var outbound = new HttpRequestMessage(request.Method, request.PathAndQuery);
            outbound.Headers.TryAddWithoutValidation(ToolHostAuthenticationHeaders.Ticket, targetTicket.Ticket);
            outbound.Headers.TryAddWithoutValidation(
                ToolHostAuthenticationHeaders.IntrospectionPath,
                targetTicket.IntrospectionPath);
            outbound.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (request.Body is { } body)
            {
                outbound.Content = JsonContent.Create(body);
            }

            var response = await rulesCoreClient.SendAsync(
                outbound,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);
            RulesWikiServerTiming.AppendDownstreamRulesCoreMetrics(timingContext, response);
            timingOutcome = response.IsSuccessStatusCode
                ? "ok"
                : $"http-{(int)response.StatusCode}";
            return response;
        }
        catch (HttpRequestException)
        {
            timingOutcome = "transport-failed";
            throw;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            timingOutcome = "timeout";
            throw;
        }
        finally
        {
            dependencyTimer.Stop();
            RulesWikiServerTiming.AppendDuration(
                timingContext,
                RulesWikiServerTiming.RulesCoreDependencyMetricName,
                dependencyTimer.Elapsed.TotalMilliseconds,
                $"{timingOperation}:{timingOutcome}");
        }
    }

    private static string TimingOperationFor(string pathAndQuery)
    {
        if (pathAndQuery.Contains("/wiki/references", StringComparison.Ordinal))
        {
            return "reference";
        }

        if (pathAndQuery.StartsWith("/api/sources/", StringComparison.Ordinal))
        {
            return "source-library";
        }

        if (pathAndQuery.StartsWith("/api/source-admin/", StringComparison.Ordinal)
            || pathAndQuery.Contains("/bundled-srds", StringComparison.Ordinal)
            || pathAndQuery.Contains("/hosted-sources", StringComparison.Ordinal))
        {
            return "source-admin";
        }

        if (pathAndQuery.Contains("/normalization/", StringComparison.Ordinal))
        {
            return "normalization";
        }

        if (pathAndQuery.Contains("/versioning/", StringComparison.Ordinal)
            || pathAndQuery.Contains("/source-updates", StringComparison.Ordinal))
        {
            return "source-versioning";
        }

        if (pathAndQuery.Contains("/adjudication/", StringComparison.Ordinal))
        {
            return "adjudication";
        }

        if (pathAndQuery.StartsWith("/api/workspace/", StringComparison.Ordinal))
        {
            return "workspace";
        }

        if (pathAndQuery.Contains("/mechanical-relationships/", StringComparison.Ordinal))
        {
            return "relationships";
        }

        if (pathAndQuery.StartsWith("/api/global/rules/", StringComparison.Ordinal)
            || pathAndQuery.Contains("/rules/", StringComparison.Ordinal))
        {
            return "rules-authoring";
        }

        return "rules-core";
    }
}
