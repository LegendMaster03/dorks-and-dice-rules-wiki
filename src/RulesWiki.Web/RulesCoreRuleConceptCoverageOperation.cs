namespace RulesWiki.Web;

/// <summary>
/// Narrow private-tunnel forwarding for the owner-run Rules Core RuleConcept coverage repair.
/// </summary>
public sealed class RulesCoreRuleConceptCoverageOperation(IRulesCorePrivateClient rulesCore)
{
    public async Task InvokeAsync(HttpContext context, bool start)
    {
        context.Response.Headers.CacheControl = "no-store";
        var authentication = HostedToolAuthenticationMiddleware.GetAuthenticationContext(context);
        if (authentication is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var coreRequest = new RulesCorePrivateRequest(
            start ? HttpMethod.Post : HttpMethod.Get,
            "/api/source-admin/import/rule-concept-coverage");

        HttpResponseMessage upstream;
        try
        {
            upstream = await rulesCore.SendAsync(authentication, coreRequest, context.RequestAborted);
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
            if (upstream.Content.Headers.ContentType is { } contentType)
                context.Response.ContentType = contentType.ToString();
            await upstream.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
        }
    }
}
