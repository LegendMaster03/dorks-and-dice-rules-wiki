using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RulesWiki.Web;

/// <summary>Target-scoped credential issued by the Tool Host for the private Core hop.</summary>
public sealed record ToolPrivateTunnelTicketResponse(string TargetKey, string Ticket, string IntrospectionPath);
public sealed record RulesCorePrivateRequest(HttpMethod Method, string PathAndQuery, JsonElement? Body = null);

public sealed class RulesCorePrivateTunnelException(string message, int statusCode = 503) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>Only the server-side dispatcher should issue native Rules Core reads.</summary>
public interface IRulesCorePrivateClient
{
    Task<HttpResponseMessage> SendAsync(
        ToolHostAuthenticationContext authentication,
        RulesCorePrivateRequest request,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Exchanges a Site-granted capability for a target-scoped ticket, then forwards
/// an allowlisted read to the private Rules Core ingress.
/// </summary>
public sealed class RulesCorePrivateClient(IHttpClientFactory httpClientFactory) : IRulesCorePrivateClient
{
    public const string ToolHostClientName = "rules-wiki-private-tunnel-control-plane";
    public const string RulesCoreClientName = "rules-core-private";
    public const string TargetToolKey = "rules-core";
    public const string TicketExchangePath = "/tool-host/rules-wiki/api/private-tunnel/rules-core/ticket";
    public const string TargetIntrospectionPath = "/tool-host/registrations/rules-core/api/introspect";

    public async Task<HttpResponseMessage> SendAsync(
        ToolHostAuthenticationContext authentication,
        RulesCorePrivateRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(authentication);
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(authentication.PrivateTunnelCapability))
            throw new RulesCorePrivateTunnelException("Rules Wiki private authorization is unavailable.");

        // The capability authorizes a ticket exchange; it is not itself sent to Core.
        var toolHostClient = httpClientFactory.CreateClient(ToolHostClientName);
        using var exchange = new HttpRequestMessage(HttpMethod.Post, TicketExchangePath);
        exchange.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", authentication.PrivateTunnelCapability);
        using var exchangeResponse = await toolHostClient.SendAsync(
            exchange, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!exchangeResponse.IsSuccessStatusCode)
            throw new RulesCorePrivateTunnelException("Rules Wiki private ticket exchange failed.");

        ToolPrivateTunnelTicketResponse ticket;
        try
        {
            ticket = await exchangeResponse.Content.ReadFromJsonAsync<ToolPrivateTunnelTicketResponse>(
                cancellationToken: cancellationToken)
                ?? throw new RulesCorePrivateTunnelException("Rules Wiki private ticket is unavailable.");
        }
        catch (JsonException)
        {
            throw new RulesCorePrivateTunnelException("Rules Wiki received an invalid ticket response.");
        }
        // Ticket exchange must authorize this exact Core target and introspection
        // endpoint. Never accept an arbitrary destination returned by the control
        // plane or broaden the pair-specific private connection.
        if (!string.Equals(ticket.TargetKey, TargetToolKey, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(ticket.Ticket) ||
            !string.Equals(ticket.IntrospectionPath, TargetIntrospectionPath, StringComparison.Ordinal))
            throw new RulesCorePrivateTunnelException("Rules Wiki received an invalid target credential.");

        // Defense in depth: the UI dispatcher already allowlists operations, but
        // the private client must independently refuse unexpected target requests.
        // Never send an arbitrary method or path, even if a future dispatcher changes.
        if (request.Method != HttpMethod.Get || request.Body is not null ||
            !Uri.TryCreate(request.PathAndQuery, UriKind.Relative, out var relative) ||
            !request.PathAndQuery.StartsWith("/api/private/rulesets", StringComparison.Ordinal) ||
            request.PathAndQuery.Contains('#'))
            throw new RulesCorePrivateTunnelException("The requested native operation is not permitted.", 400);

        // Forward only the validated target ticket and fixed introspection route.
        // The outbound client is configured against the private Core base address.
        var rulesCoreClient = httpClientFactory.CreateClient(RulesCoreClientName);
        using var outbound = new HttpRequestMessage(HttpMethod.Get, relative);
        outbound.Headers.TryAddWithoutValidation(ToolHostAuthenticationHeaders.Ticket, ticket.Ticket);
        outbound.Headers.TryAddWithoutValidation(ToolHostAuthenticationHeaders.IntrospectionPath, TargetIntrospectionPath);
        outbound.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return await rulesCoreClient.SendAsync(
            outbound, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }
}
