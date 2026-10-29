using System.Text.Json;

namespace RulesWiki.Web;

public sealed class RulesWikiUiOperationRequest
{
    public JsonElement[] Arguments { get; init; } = [];
}

/// <summary>
/// Explicit allowlist. Browser callers can select only these three native reads;
/// they can not supply arbitrary Core paths, HTTP methods, or request bodies.
/// </summary>
public sealed class RulesCoreUiOperationDispatcher(IRulesCorePrivateClient rulesCore)
{
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

    public static RulesCorePrivateRequest BuildRequest(string operation, JsonElement[] arguments)
    {
        ArgumentNullException.ThrowIfNull(arguments);
        return operation switch
        {
            "getNativeRulesets" when arguments.Length == 0 => Get("/api/private/rulesets"),
            "searchNativeRules" when arguments.Length == 2 => Search(arguments),
            "getNativeRule" when arguments.Length == 2 => Get(
                $"/api/private/rulesets/{Escape(Id(arguments, 0))}/rules/{Escape(Id(arguments, 1))}"),
            _ => throw new KeyNotFoundException("Unknown or unsupported Rules Wiki operation.")
        };
    }

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

    private static string Id(JsonElement[] arguments, int index)
    {
        var value = arguments[index].ValueKind == JsonValueKind.String
            ? arguments[index].GetString() : null;
        if (string.IsNullOrWhiteSpace(value) || value.Length > 160 ||
            value.Contains('/') || value.Contains('\\'))
            throw new InvalidDataException();
        return value;
    }

    private static string Escape(string value) => Uri.EscapeDataString(value);
    private static RulesCorePrivateRequest Get(string path) => new(HttpMethod.Get, path);
}
