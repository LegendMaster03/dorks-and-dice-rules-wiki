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

public sealed class RulesCorePrivateClient(IHttpClientFactory httpClientFactory) : IRulesCorePrivateClient
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

        if (string.IsNullOrWhiteSpace(authentication.PrivateTunnelCapability))
        {
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

        return await rulesCoreClient.SendAsync(
            outbound,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
    }
}
