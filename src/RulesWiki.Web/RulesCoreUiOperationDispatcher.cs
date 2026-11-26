using System.Text.Json;
using System.Text.RegularExpressions;

namespace RulesWiki.Web;

public sealed class RulesWikiUiOperationRequest
{
    public JsonElement[] Arguments { get; init; } = [];
}

/// <summary>
/// Explicit allowlist. Browser callers can select only explicitly named native reads;
/// they can not supply arbitrary Core paths, HTTP methods, or request bodies.
/// </summary>
public sealed class RulesCoreUiOperationDispatcher(IRulesCorePrivateClient rulesCore)
{
    private static readonly Regex SafeRulesetId = new(@"\A[a-z0-9]+(?:-[a-z0-9]+)*\z",
        RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));
    private static readonly Regex SafeRuleId = new(@"\A[a-z0-9-]+(?:\.[a-z0-9-]+)+\z",
        RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));

    /// <summary>Translate a browser operation into one validated private Core read.</summary>
    public async Task InvokeAsync(HttpContext context, string operation, RulesWikiUiOperationRequest request)
    {
        context.Response.Headers.CacheControl = "no-store";
        var authentication = HostedToolAuthenticationMiddleware.GetAuthenticationContext(context);
        if (authentication is null)
        {
            context.Response.StatusCode = 401;
            return;
        }

        RulesCorePrivateRequest coreRequest;
        try { coreRequest = BuildRequest(operation, request.Arguments); }
        catch (KeyNotFoundException)
        {
            context.Response.StatusCode = 404;
            return;
        }
        catch (InvalidDataException)
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { error = "invalid_operation_arguments" });
            return;
        }

        try
        {
            using var upstream = await rulesCore.SendAsync(authentication, coreRequest, context.RequestAborted);
            context.Response.StatusCode = (int)upstream.StatusCode;
            if (upstream.Content.Headers.ContentType is { } contentType)
                context.Response.ContentType = contentType.ToString();
            await upstream.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
        catch (RulesCorePrivateTunnelException exception)
        {
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(new { error = "private_tunnel_unavailable" });
        }
        catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
        {
            context.Response.StatusCode = 504;
        }
        catch (HttpRequestException)
        {
            context.Response.StatusCode = 502;
        }
    }

    /// <summary>
    /// This mapping is the browser-facing API boundary. Adding a native endpoint
    /// requires an explicit operation here; arbitrary paths are not accepted.
    /// </summary>
    public static RulesCorePrivateRequest BuildRequest(string operation, JsonElement[] arguments)
    {
        if (arguments is null) throw new InvalidDataException();
        return operation switch
        {
            "getNativeRulesets" when arguments.Length == 0 => Get("/api/private/rulesets"),
            "searchNativeRules" when arguments.Length == 2 => Search(arguments),
            "getNativeRule" when arguments.Length == 2 => Get(
                $"/api/private/rulesets/{Escape(Id(arguments, 0))}/rules/{Escape(Id(arguments, 1, rule: true))}"),
            "getNativeOriginHierarchy" when arguments.Length == 3 => Origin(arguments, "hierarchy"),
            "getNativeOriginSource" when arguments.Length == 3 => Origin(arguments, "source"),
            "getNativeOriginTraitSources" when arguments.Length == 3 => Origin(arguments, "trait-sources"),
            "getNativeOriginComponent" when arguments.Length == 3 => Origin(arguments, "component"),
            "getNativeOriginMethods" when arguments.Length == 3 => Origin(arguments, "methods"),
            "getNativeOriginComponentSources" when arguments.Length == 3 => Origin(arguments, "component-sources"),
            _ => throw new KeyNotFoundException("Unknown or unsupported Rules Wiki operation.")
        };
    }

    private static bool OriginFamily(string value) =>
        value is "biological" or "upbringing" or "construct-components" or
            "characteristics" or "backgrounds" or "construct-options";

    private static bool OriginTarget(string projection, string target) => projection switch
    {
        "hierarchy" => OriginFamily(target),
        "methods" => target == "all" || (IsRuleId(target) && target.StartsWith("creature-type.", StringComparison.Ordinal)),
        "source" or "trait-sources" or "component" or "component-sources" => IsRuleId(target),
        _ => false
    };

    private static bool ValidFingerprint(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= 160 &&
        !value.Any(char.IsWhiteSpace);

    private static RulesCorePrivateRequest Origin(JsonElement[] arguments, string projection)
    {
        var ruleset = Id(arguments, 0);
        if (ruleset != "first-party-001" || arguments[1].ValueKind != JsonValueKind.String ||
            arguments[2].ValueKind != JsonValueKind.String) throw new InvalidDataException();
        var fingerprint = arguments[1].GetString();
        var target = arguments[2].GetString();
        if (!ValidFingerprint(fingerprint) || target is null ||
            !OriginTarget(projection, target))
            throw new InvalidDataException();
        return Get($"/api/private/rulesets/{Escape(ruleset)}/origins/{projection}/{Escape(target)}?fingerprint={Escape(fingerprint!)}");
    }

    // Search parameters are an allowlist, including their value types and size.
    // Escape each component before constructing the private Core query string.
    private static RulesCorePrivateRequest Search(JsonElement[] arguments)
    {
        var rulesetId = Id(arguments, 0);
        var filter = arguments[1];
        if (filter.ValueKind != JsonValueKind.Object) throw new InvalidDataException();
        var parameters = new List<string>();
        foreach (var property in filter.EnumerateObject())
        {
            if (property.Name is not ("q" or "category" or "limit" or "offset") ||
                property.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
                throw new InvalidDataException();
            var value = property.Value.ToString();
            if (value.Length > 200) throw new InvalidDataException();
            parameters.Add($"{Escape(property.Name)}={Escape(value)}");
        }
        var path = $"/api/private/rulesets/{Escape(rulesetId)}/rules";
        return Get(parameters.Count == 0 ? path : $"{path}?{string.Join('&', parameters)}");
    }

    // Validate identities before constructing a URI: escaping alone does not
    // prevent dot-segment normalization by the outbound HTTP client.
    private static bool IsRulesetId(string value) => value.Length <= 80 && SafeRulesetId.IsMatch(value);
    private static bool IsRuleId(string value) => value.Length <= 160 && SafeRuleId.IsMatch(value);

    private static string Id(JsonElement[] arguments, int index, bool rule = false)
    {
        var value = arguments[index].ValueKind == JsonValueKind.String
            ? arguments[index].GetString() : null;
        if (value is null || !(rule ? IsRuleId(value) : IsRulesetId(value)))
            throw new InvalidDataException();
        return value;
    }

    // Reuse the identity grammar in the private client as defense in depth.
    // Only explicitly allowed native read route shapes can be sent, even if another
    // server-side caller is added later. The dispatcher owns query validation.
    internal static bool IsNativeReadPath(string pathAndQuery)
    {
        var parts = pathAndQuery.Split('?', 2);
        var path = parts[0].Split('/');
        if (path.Length < 4 || path[0] != "" || path[1] != "api" ||
            path[2] != "private" || path[3] != "rulesets") return false;
        if (path.Length == 4) return parts.Length == 1;
        if (path.Length == 8 && path[4] == "first-party-001" && path[5] == "origins")
        {
            if (parts.Length != 2 || !parts[1].StartsWith("fingerprint=", StringComparison.Ordinal))
                return false;
            var encoded = parts[1]["fingerprint=".Length..];
            var fingerprint = Uri.UnescapeDataString(encoded);
            if (!ValidFingerprint(fingerprint) || Escape(fingerprint) != encoded) return false;
            return OriginTarget(path[6], path[7]);
        }
        if (path.Length is not (6 or 7) || !IsRulesetId(path[4]) || path[5] != "rules") return false;
        return path.Length == 6 || (parts.Length == 1 && IsRuleId(path[6]));
    }

    private static string Escape(string value) => Uri.EscapeDataString(value);
    private static RulesCorePrivateRequest Get(string path) => new(HttpMethod.Get, path);
}
