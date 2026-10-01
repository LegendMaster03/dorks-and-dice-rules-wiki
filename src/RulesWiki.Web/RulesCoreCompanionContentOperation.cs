using System.Net.Http.Headers;
using System.Text.Json;

namespace RulesWiki.Web;

public sealed class RulesCoreCompanionContentOperation(IRulesCorePrivateClient rulesCore)
{
    public async Task InvokeAsync(
        HttpContext context,
        RulesWikiUiOperationRequest request)
    {
        context.Response.Headers.CacheControl = "no-store";
        var authentication = HostedToolAuthenticationMiddleware.GetAuthenticationContext(context);
        if (authentication is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var arguments = request.Arguments ?? [];
        if (arguments.Length == 0
            || arguments[0].ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(arguments[0].GetString()))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new { error = "Reference identity is required." },
                context.RequestAborted);
            return;
        }

        var referenceIdentity = arguments[0].GetString()!.Trim();
        string? campaignId = null;
        if (arguments.Length > 1 && arguments[1].ValueKind != JsonValueKind.Null)
        {
            if (arguments[1].ValueKind != JsonValueKind.String
                || !Guid.TryParse(arguments[1].GetString(), out var parsedCampaignId))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsJsonAsync(
                    new { error = "Campaign ID must be a valid GUID when supplied." },
                    context.RequestAborted);
                return;
            }
            campaignId = parsedCampaignId.ToString("D");
        }

        var escapedReferenceIdentity = Uri.EscapeDataString(referenceIdentity);
        var path = campaignId is null
            ? $"/api/wiki/references/{escapedReferenceIdentity}/companion-content"
            : $"/api/campaigns/{Uri.EscapeDataString(campaignId)}/wiki/references/{escapedReferenceIdentity}/companion-content";

        HttpResponseMessage upstream;
        try
        {
            upstream = await rulesCore.SendAsync(
                authentication,
                new RulesCorePrivateRequest(HttpMethod.Get, path),
                context.RequestAborted);
        }
        catch (RulesCorePrivateTunnelException exception)
        {
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(new { error = exception.Message }, context.RequestAborted);
            return;
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
            if (upstream.Content.Headers.ContentType is MediaTypeHeaderValue contentType)
                context.Response.ContentType = contentType.ToString();
            await upstream.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
    }
}
