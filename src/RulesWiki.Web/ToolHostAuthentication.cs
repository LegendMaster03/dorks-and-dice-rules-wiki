using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RulesWiki.Web;

public static class ToolHostAuthenticationHeaders
{
    public const string Ticket = "X-Dorks-Tool-Auth-Ticket";
    public const string IntrospectionPath = "X-Dorks-Tool-Auth-Introspection-Path";
    public const string DelegationCapability = "X-Dorks-Tool-Delegation-Capability";
    public const string DelegationPath = "X-Dorks-Tool-Delegation-Path";
}

public sealed record ToolHostUserContext(string Id, string DisplayName);
public sealed record ToolHostCampaignContext(Guid Id, string Name, string Role);

public sealed record ToolHostAuthenticationContext(
    int ContractVersion,
    string ToolSlug,
    string SiteMode,
    ToolHostUserContext User,
    IReadOnlyList<string> GlobalRoles,
    IReadOnlyList<ToolHostCampaignContext> Campaigns)
{
    public string? DelegationCapability { get; init; }
    public string? DelegationPath { get; init; }
}

public interface IToolHostAuthenticationClient
{
    Task<ToolHostAuthenticationContext?> RedeemAsync(
        string ticket,
        string introspectionPath,
        CancellationToken cancellationToken = default);
}

public sealed class DorksAndDiceToolHostAuthenticationClient(HttpClient httpClient)
    : IToolHostAuthenticationClient
{
    public const string ExpectedToolSlug = "rules-wiki";
    public const string ExpectedIntrospectionPath = "/tool-host/rules-wiki/api/introspect";
    public const string ExpectedDelegationPath = "/tool-host/rules-wiki/api/delegate/{targetSlug}/upstream";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ToolHostAuthenticationContext?> RedeemAsync(
        string ticket,
        string introspectionPath,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(ticket))
            throw new ArgumentException("Tool Host ticket can not be blank.", nameof(ticket));
        if (!string.Equals(introspectionPath, ExpectedIntrospectionPath, StringComparison.Ordinal))
            throw new InvalidDataException("The Tool Host introspection path is not valid for Rules Wiki.");
        if (httpClient.BaseAddress is null)
            throw new InvalidOperationException("ToolHost:BaseUrl must be configured before hosted authentication can be used.");

        using var request = new HttpRequestMessage(HttpMethod.Post, ExpectedIntrospectionPath);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ticket.Trim());
        using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized) return null;
        response.EnsureSuccessStatusCode();

        var context = await response.Content.ReadFromJsonAsync<ToolHostAuthenticationContext>(JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Tool Host introspection returned an empty authentication context.");
        if (context.ContractVersion != 1)
            throw new InvalidDataException($"Unsupported Tool Host authentication contract version '{context.ContractVersion}'.");
        if (!string.Equals(context.ToolSlug, ExpectedToolSlug, StringComparison.Ordinal))
            throw new InvalidDataException("Tool Host authentication context was issued for another Tool.");
        if (string.IsNullOrWhiteSpace(context.SiteMode))
            throw new InvalidDataException("Tool Host authentication context does not include a site mode.");
        if (context.User is null || string.IsNullOrWhiteSpace(context.User.Id))
            throw new InvalidDataException("Tool Host authentication context does not include a stable user ID.");

        var capability = ReadOptionalSingleHeader(response, ToolHostAuthenticationHeaders.DelegationCapability);
        var delegationPath = ReadOptionalSingleHeader(response, ToolHostAuthenticationHeaders.DelegationPath);
        if ((capability is null) != (delegationPath is null))
            throw new InvalidDataException("Tool Host delegation capability and path must be supplied together.");
        if (delegationPath is not null && !string.Equals(delegationPath, ExpectedDelegationPath, StringComparison.Ordinal))
            throw new InvalidDataException("Tool Host returned an unexpected delegation path.");

        return context with { DelegationCapability = capability, DelegationPath = delegationPath };
    }

    private static string? ReadOptionalSingleHeader(HttpResponseMessage response, string name)
    {
        if (!response.Headers.TryGetValues(name, out var values)) return null;
        var entries = values.Where(value => !string.IsNullOrWhiteSpace(value)).ToArray();
        if (entries.Length != 1)
            throw new InvalidDataException($"Tool Host returned an invalid '{name}' header.");
        return entries[0].Trim();
    }
}
