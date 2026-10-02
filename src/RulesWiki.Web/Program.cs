using RulesWiki.Web;

var builder = WebApplication.CreateBuilder(args);

var toolHostBaseUri = RequireHttpUri(builder.Configuration, "ToolHost:BaseUrl");
var rulesCorePrivateBaseUri = RequireHttpUri(builder.Configuration, "RulesCorePrivate:BaseUrl");

builder.Services.AddHttpClient<IToolHostAuthenticationClient, DorksAndDiceToolHostAuthenticationClient>(client =>
{
    client.BaseAddress = toolHostBaseUri;
    client.Timeout = TimeSpan.FromSeconds(3);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });

builder.Services.AddHttpClient(RulesCorePrivateClient.ToolHostClientName, client =>
{
    client.BaseAddress = toolHostBaseUri;
    client.Timeout = TimeSpan.FromSeconds(3);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });

builder.Services.AddHttpClient(RulesCorePrivateClient.RulesCoreClientName, client =>
{
    client.BaseAddress = rulesCorePrivateBaseUri;
    client.Timeout = TimeSpan.FromMinutes(10);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });

builder.Services.AddSingleton<IRulesCorePrivateClient, RulesCorePrivateClient>();
builder.Services.AddSingleton<RulesCoreUiOperationDispatcher>();
builder.Services.AddSingleton<RulesCoreCompanionContentOperation>();
builder.Services.AddSingleton<RulesCoreCorpusReconciliationOperation>();
builder.Services.AddSingleton<RulesCoreRuleConceptCoverageOperation>();
builder.Services.AddHealthChecks();
var app = builder.Build();

app.UseMiddleware<HostedToolAuthenticationMiddleware>();
app.UseStaticFiles();

app.MapHealthChecks("/health");
app.MapGet("/ready", () => Results.Ok(new
{
    status = "ready",
    persistence = "stateless",
    rulesBackend = "rules-core-private",
    authentication = "tool-host-private-tunnel"
}));

app.MapPost("/_rules-wiki/operations/getWikiReferenceCompanionContent", async (
    HttpContext context,
    RulesWikiUiOperationRequest request,
    RulesCoreCompanionContentOperation operation) =>
{
    await operation.InvokeAsync(context, request);
});

app.MapPost("/_rules-wiki/operations/getCorpusReconciliationStatus", async (
    HttpContext context,
    RulesWikiUiOperationRequest request,
    RulesCoreCorpusReconciliationOperation operation) =>
{
    await operation.InvokeAsync(context, start: false);
});

app.MapPost("/_rules-wiki/operations/startCorpusReconciliation", async (
    HttpContext context,
    RulesWikiUiOperationRequest request,
    RulesCoreCorpusReconciliationOperation operation) =>
{
    await operation.InvokeAsync(context, start: true);
});

app.MapPost("/_rules-wiki/operations/getRuleConceptCoverageStatus", async (
    HttpContext context,
    RulesWikiUiOperationRequest request,
    RulesCoreRuleConceptCoverageOperation operation) =>
{
    await operation.InvokeAsync(context, start: false);
});

app.MapPost("/_rules-wiki/operations/startRuleConceptCoverageRepair", async (
    HttpContext context,
    RulesWikiUiOperationRequest request,
    RulesCoreRuleConceptCoverageOperation operation) =>
{
    await operation.InvokeAsync(context, start: true);
});

app.MapPost("/_rules-wiki/operations/{operation}", async (
    HttpContext context,
    string operation,
    RulesWikiUiOperationRequest request,
    RulesCoreUiOperationDispatcher dispatcher) =>
{
    await dispatcher.InvokeAsync(context, operation, request);
});

const string standaloneShell = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dorks & Dice Rules Wiki</title>
</head>
<body>
  <main id="tool-root"></main>
  <script type="module" src="/app.js"></script>
</body>
</html>
""";

app.MapGet("/", () => Results.Content(standaloneShell, "text/html; charset=utf-8"));
app.MapFallback((HttpContext context) =>
{
    if (Path.HasExtension(context.Request.Path)) return Results.NotFound();
    return Results.Content(standaloneShell, "text/html; charset=utf-8");
});

app.Run();

static Uri RequireHttpUri(IConfiguration configuration, string key)
{
    var value = configuration[key];
    if (string.IsNullOrWhiteSpace(value)
        || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
        || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
    {
        throw new InvalidOperationException($"{key} must be configured as an absolute HTTP or HTTPS URL.");
    }

    return uri;
}

public partial class Program { }
