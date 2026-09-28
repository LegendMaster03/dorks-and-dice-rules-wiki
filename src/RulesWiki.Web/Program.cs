using RulesWiki.Web;

var builder = WebApplication.CreateBuilder(args);

var toolHostBaseUrl = builder.Configuration["ToolHost:BaseUrl"];
if (string.IsNullOrWhiteSpace(toolHostBaseUrl)
    || !Uri.TryCreate(toolHostBaseUrl, UriKind.Absolute, out var toolHostBaseUri)
    || (toolHostBaseUri.Scheme != Uri.UriSchemeHttp && toolHostBaseUri.Scheme != Uri.UriSchemeHttps))
{
    throw new InvalidOperationException("ToolHost:BaseUrl must be configured as an absolute HTTP or HTTPS URL.");
}

builder.Services.AddHttpClient<IToolHostAuthenticationClient, DorksAndDiceToolHostAuthenticationClient>(client =>
{
    client.BaseAddress = toolHostBaseUri;
    client.Timeout = TimeSpan.FromSeconds(3);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });

builder.Services.AddHttpClient<RulesCoreDelegationProxy>(client =>
{
    client.BaseAddress = toolHostBaseUri;
    client.Timeout = TimeSpan.FromMinutes(10);
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });

builder.Services.AddHealthChecks();
var app = builder.Build();

app.UseMiddleware<HostedToolAuthenticationMiddleware>();
app.UseStaticFiles();

app.MapHealthChecks("/health");
app.MapGet("/ready", () => Results.Ok(new
{
    status = "ready",
    persistence = "stateless",
    rulesBackend = RulesCoreDelegationProxy.TargetToolSlug,
    authentication = "tool-host-delegation"
}));

app.MapMethods("/api/{**path}", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    async (HttpContext context, RulesCoreDelegationProxy proxy) => await proxy.ForwardAsync(context));

app.MapGet("/api", async (HttpContext context, RulesCoreDelegationProxy proxy) => await proxy.ForwardAsync(context));

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

public partial class Program { }
