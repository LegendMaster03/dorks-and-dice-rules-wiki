using System.Globalization;
using System.Text.Json;

namespace RulesWiki.Web;

public sealed class RulesWikiUiOperationRequest
{
    public JsonElement[] Arguments { get; init; } = [];
}

public sealed class RulesCoreUiOperationDispatcher(IRulesCorePrivateClient rulesCore)
{
    public async Task InvokeAsync(
        HttpContext context,
        string operation,
        RulesWikiUiOperationRequest request)
    {
        context.Response.Headers.CacheControl = "no-store";
        var authentication = HostedToolAuthenticationMiddleware.GetAuthenticationContext(context);
        if (authentication is null)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        RulesCorePrivateRequest coreRequest;
        try
        {
            coreRequest = BuildRequest(operation, request.Arguments);
        }
        catch (KeyNotFoundException)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        catch (InvalidDataException exception)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { error = exception.Message }, context.RequestAborted);
            return;
        }

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

    public static RulesCorePrivateRequest BuildRequest(string operation, JsonElement[] arguments) =>
        operation switch
        {
            "searchSourceEntities" => Get(Query("/api/sources/entities",
                ("entityType", OptionString(arguments, 0, "entityType")),
                ("q", OptionString(arguments, 0, "query")),
                ("limit", OptionInt(arguments, 0, "limit", 100).ToString(CultureInfo.InvariantCulture)))),
            "searchSourceEntityPage" => Get(Query("/api/sources/entities/page",
                ("entityType", OptionString(arguments, 0, "entityType")),
                ("q", OptionString(arguments, 0, "query")),
                ("limit", OptionInt(arguments, 0, "limit", 100).ToString(CultureInfo.InvariantCulture)),
                ("offset", Math.Max(0, OptionInt(arguments, 0, "offset", 0)).ToString(CultureInfo.InvariantCulture)))),
            "getSourceEntity" => Get($"/api/sources/entities/{Escape(StringArg(arguments, 0))}"),
            "getSourceEntityNative" => Get($"/api/sources/entities/{Escape(StringArg(arguments, 0))}/native"),
            "getCurrentUserSources" => Get("/api/sources/current-user"),
            "getCurrentUserSourceImportJobs" => Get("/api/sources/current-user/import-jobs"),
            "dismissCurrentUserSourceImportJobs" => Post("/api/sources/current-user/import-jobs/dismiss",
                ObjectBody(("jobIds", Arg(arguments, 0)))),
            "getCurrentUserSourceReconciliationIssues" => Get($"/api/sources/current-user/{Escape(StringArg(arguments, 0))}/reconciliation-issues"),
            "getCurrentUserSourceImportJobReconciliationIssues" => Get($"/api/sources/current-user/import-jobs/{Escape(StringArg(arguments, 0))}/reconciliation-issues"),
            "addCurrentUserSource" => Post("/api/sources/current-user", BodyArg(arguments, 0)),
            "refreshCurrentUserSource" => Post($"/api/sources/current-user/{Escape(StringArg(arguments, 0))}/refresh"),
            "removeCurrentUserSource" => Delete($"/api/sources/current-user/{Escape(StringArg(arguments, 0))}"),
            "previewSourceDocument" => Post("/api/source-admin/import/preview", BodyArg(arguments, 0)),
            "importSourceDocument" => Post("/api/source-admin/import", BodyArg(arguments, 0)),
            "findHostedSourceMatches" => Post("/api/source-admin/import/hosted-matches", BodyArg(arguments, 0)),
            "getBundledSrds" => Get("/api/global/rules/bundled-srds"),
            "reprocessBundledSrd" => Post($"/api/global/rules/bundled-srds/{Escape(StringArg(arguments, 0))}/reprocess"),
            "getHostedSources" => Get(Query("/api/global/rules/hosted-sources",
                ("includeDisabled", BoolArg(arguments, 0, true) ? "true" : "false"))),
            "getHostedSource" => Get($"/api/global/rules/hosted-sources/{Escape(StringArg(arguments, 0))}"),
            "setHostedSource" => Put($"/api/global/rules/hosted-sources/{Escape(StringArg(arguments, 0))}", BodyArg(arguments, 1)),
            "previewHostedSource" => Post($"/api/global/rules/hosted-sources/{Escape(StringArg(arguments, 0))}/preview"),
            "refreshHostedSource" => Post($"/api/global/rules/hosted-sources/{Escape(StringArg(arguments, 0))}/refresh"),
            "getSourceAdministrationPackages" => Get("/api/source-admin/packages"),
            "grantCurrentUserSourcePackage" => Post($"/api/source-admin/packages/{Escape(StringArg(arguments, 0))}/current-user-grant"),
            "revokeCurrentUserSourcePackage" => Delete($"/api/source-admin/packages/{Escape(StringArg(arguments, 0))}/current-user-grant"),
            "getCurrentUserSourceAcquisitions" => Get("/api/source-admin/acquisitions"),
            "recordCurrentUserSourceAcquisition" => Post($"/api/source-admin/packages/{Escape(StringArg(arguments, 0))}/current-user-acquisitions", BodyArg(arguments, 1)),
            "voidCurrentUserSourceAcquisition" => Post($"/api/source-admin/acquisitions/{Escape(StringArg(arguments, 0))}/void", BodyArgOrEmpty(arguments, 1)),
            "getSourceNormalizationCandidates" => Get(Query("/api/global/rules/normalization/candidates",
                ("entityType", OptionString(arguments, 0, "entityType")),
                ("q", OptionString(arguments, 0, "query")),
                ("limit", OptionInt(arguments, 0, "limit", 100).ToString(CultureInfo.InvariantCulture)),
                ("offset", Math.Max(0, OptionInt(arguments, 0, "offset", 0)).ToString(CultureInfo.InvariantCulture)))),
            "getIgnoredNormalizationPackages" => Get("/api/global/rules/normalization/ignored-packages"),
            "setNormalizationPackageIgnored" => Put($"/api/global/rules/normalization/packages/{Escape(StringArg(arguments, 0))}/ignored",
                JsonSerializer.SerializeToElement(new { ignored = BoolArg(arguments, 1, false) })),
            "acceptSourceNormalization" => Post($"/api/global/rules/normalization/entities/{Escape(StringArg(arguments, 0))}/accept"),
            "detectSourceVersions" => Get($"/api/global/rules/versioning/entities/{Escape(StringArg(arguments, 0))}/candidates"),
            "bindDetectedSourceVersion" => Post($"/api/global/rules/versioning/entities/{Escape(StringArg(arguments, 0))}/bind",
                JsonSerializer.SerializeToElement(new { ruleConceptId = StringArg(arguments, 1) })),
            "createSourceLineage" => Post("/api/global/rules/versioning/lineage", BodyArg(arguments, 0)),
            "voidSourceLineage" => Post($"/api/global/rules/versioning/lineage/{Escape(StringArg(arguments, 0))}/void",
                JsonSerializer.SerializeToElement(new { reason = NullableStringArg(arguments, 1) })),
            "getRuleConsolidation" => Get($"/api/global/rules/concepts/{Escape(StringArg(arguments, 0))}/consolidation"),
            "getSourceRevisionUpdates" => Get("/api/global/rules/source-updates"),
            "previewSourceRevisionUpdate" => Get($"/api/global/rules/source-updates/{Escape(StringArg(arguments, 0))}/preview"),
            "adoptLatestSourceRevision" => Post($"/api/global/rules/source-updates/{Escape(StringArg(arguments, 0))}/adopt", BodyArg(arguments, 1)),
            "rejectLatestSourceRevision" => Post($"/api/global/rules/source-updates/{Escape(StringArg(arguments, 0))}/reject", BodyArg(arguments, 1)),
            "createGlobalConcept" => Post("/api/global/rules/concepts", BodyArg(arguments, 0)),
            "bindGlobalConceptSource" => Post($"/api/global/rules/concepts/{Escape(StringArg(arguments, 0))}/bindings",
                JsonSerializer.SerializeToElement(new { sourceEntityId = StringArg(arguments, 1) })),
            "getGlobalAuthoringOverview" => Get("/api/global/rules/authoring"),
            "getGlobalAuthoringConcept" => Get($"/api/global/rules/authoring/concepts/{Escape(StringArg(arguments, 0))}"),
            "previewGlobalDecision" => Post($"/api/global/rules/concepts/{Escape(StringArg(arguments, 0))}/preview", BodyArg(arguments, 1)),
            "saveGlobalDecision" => Put($"/api/global/rules/concepts/{Escape(StringArg(arguments, 0))}/decision", BodyArg(arguments, 1)),
            "discoverAdjudicationWork" => Post("/api/global/rules/adjudication/discover"),
            "getAdjudicationWork" => Get(Query("/api/global/rules/adjudication/work",
                ("kind", OptionString(arguments, 0, "kind")),
                ("state", OptionString(arguments, 0, "state")),
                ("includePublishedCompleted", OptionBool(arguments, 0, "includePublishedCompleted", false) ? "true" : null))),
            "getAdjudicationWorkItem" => Get($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}"),
            "beginAdjudicationWork" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/begin",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1) })),
            "requestAdjudicationClarification" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/clarification",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1), question = StringArg(arguments, 2) })),
            "answerAdjudicationClarification" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/clarification/answer",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1), answer = StringArg(arguments, 2) })),
            "escalateAdjudicationWork" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/escalate",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1), reason = StringArg(arguments, 2) })),
            "deferAdjudicationWork" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/defer",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1), reason = StringArg(arguments, 2) })),
            "reopenAdjudicationWork" => Post($"/api/global/rules/adjudication/work/{Escape(StringArg(arguments, 0))}/reopen",
                JsonSerializer.SerializeToElement(new { expectedVersion = IntArg(arguments, 1) })),
            "publishGlobalRules" => Post("/api/global/rules/publish"),
            "getCampaignAuthoringOverview" => Get($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/authoring"),
            "getCampaignAuthoringConcept" => Get($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/authoring/concepts/{Escape(StringArg(arguments, 1))}"),
            "getCampaignBaselineCandidates" => Get($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/baselines"),
            "previewCampaignBaseline" => Get($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/baselines/{Escape(StringArg(arguments, 1))}/preview"),
            "previewCampaignDecision" => Post($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/concepts/{Escape(StringArg(arguments, 1))}/preview", BodyArg(arguments, 2)),
            "saveCampaignDecision" => Put($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/concepts/{Escape(StringArg(arguments, 1))}/decision", BodyArg(arguments, 2)),
            "publishCampaignRules" => Post($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/publish"),
            "selectCampaignBaseline" => Put($"/api/campaigns/{Escape(StringArg(arguments, 0))}/rules/baseline",
                JsonSerializer.SerializeToElement(new { rulesetRevisionId = StringArg(arguments, 1) })),
            "getWorkspaceScopes" => Get("/api/workspace/scopes"),
            "compareWorkspace" => Post("/api/workspace/comparison", BodyArg(arguments, 0)),
            "getMechanicalRelationships" => Get($"/api/global/rules/mechanical-relationships/concepts/{Escape(StringArg(arguments, 0))}"),
            "saveMechanicalRelationshipRuling" => Put($"/api/global/rules/mechanical-relationships/{Escape(StringArg(arguments, 0))}/ruling", BodyArg(arguments, 1)),
            "getWikiReferenceCatalog" => Get(BuildWikiReferenceCatalogPath(arguments)),
            "getWikiReferenceDetail" => Get(BuildWikiReferenceDetailPath(arguments, classFamily: false)),
            "getClassFamilyRelations" => Get(BuildWikiReferenceDetailPath(arguments, classFamily: true)),
            "compareWikiReferenceVersions" => Post("/api/wiki/references/comparison", BodyArg(arguments, 0)),
            _ => throw new KeyNotFoundException($"Unknown Rules Wiki UI operation '{operation}'.")
        };

    private static string BuildWikiReferenceCatalogPath(JsonElement[] arguments)
    {
        var campaignId = NullableStringArg(arguments, 0);
        var path = campaignId is null
            ? "/api/wiki/references"
            : $"/api/campaigns/{Escape(campaignId)}/wiki/references";
        return Query(path,
            ("entityType", OptionString(arguments, 1, "entityType")),
            ("q", OptionString(arguments, 1, "q")),
            ("source", OptionString(arguments, 1, "source")),
            ("package", OptionString(arguments, 1, "package")),
            ("edition", OptionString(arguments, 1, "edition")),
            ("overridesOnly", OptionBool(arguments, 1, "overridesOnly", false) ? "true" : null),
            ("categoryMode", OptionString(arguments, 1, "categoryMode")),
            ("limit", OptionString(arguments, 1, "limit")),
            ("offset", OptionString(arguments, 1, "offset")));
    }

    private static string BuildWikiReferenceDetailPath(JsonElement[] arguments, bool classFamily)
    {
        var referenceIdentity = Escape(StringArg(arguments, 0));
        var campaignId = NullableStringArg(arguments, 1);
        var path = campaignId is null
            ? $"/api/wiki/references/{referenceIdentity}"
            : $"/api/campaigns/{Escape(campaignId)}/wiki/references/{referenceIdentity}";
        return classFamily ? $"{path}/class-family" : path;
    }

    private static RulesCorePrivateRequest Get(string path) => new(HttpMethod.Get, path);
    private static RulesCorePrivateRequest Post(string path, JsonElement? body = null) => new(HttpMethod.Post, path, body);
    private static RulesCorePrivateRequest Put(string path, JsonElement body) => new(HttpMethod.Put, path, body);
    private static RulesCorePrivateRequest Delete(string path) => new(HttpMethod.Delete, path);

    private static string Query(string path, params (string Key, string? Value)[] values)
    {
        var query = values
            .Where(value => !string.IsNullOrWhiteSpace(value.Value))
            .Select(value => $"{Uri.EscapeDataString(value.Key)}={Uri.EscapeDataString(value.Value!)}")
            .ToArray();
        return query.Length == 0 ? path : $"{path}?{string.Join('&', query)}";
    }

    private static string Escape(string value) => Uri.EscapeDataString(value);

    private static JsonElement Arg(JsonElement[] arguments, int index)
    {
        if (index >= arguments.Length)
            throw new InvalidDataException($"Missing argument {index}.");
        return arguments[index];
    }

    private static JsonElement BodyArg(JsonElement[] arguments, int index) => Arg(arguments, index).Clone();

    private static JsonElement BodyArgOrEmpty(JsonElement[] arguments, int index) =>
        index < arguments.Length && arguments[index].ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            ? arguments[index].Clone()
            : JsonSerializer.SerializeToElement(new { });

    private static JsonElement ObjectBody(params (string Name, JsonElement Value)[] properties) =>
        JsonSerializer.SerializeToElement(properties.ToDictionary(property => property.Name, property => property.Value));

    private static string StringArg(JsonElement[] arguments, int index)
    {
        var value = NullableStringArg(arguments, index);
        return string.IsNullOrWhiteSpace(value)
            ? throw new InvalidDataException($"Argument {index} must be a non-empty string.")
            : value;
    }

    private static string? NullableStringArg(JsonElement[] arguments, int index)
    {
        if (index >= arguments.Length || arguments[index].ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        return arguments[index].ValueKind == JsonValueKind.String
            ? arguments[index].GetString()
            : arguments[index].ToString();
    }

    private static int IntArg(JsonElement[] arguments, int index)
    {
        var argument = Arg(arguments, index);
        return argument.ValueKind == JsonValueKind.Number && argument.TryGetInt32(out var value)
            ? value
            : int.TryParse(argument.ToString(), CultureInfo.InvariantCulture, out value)
                ? value
                : throw new InvalidDataException($"Argument {index} must be an integer.");
    }

    private static bool BoolArg(JsonElement[] arguments, int index, bool defaultValue)
    {
        if (index >= arguments.Length) return defaultValue;
        var argument = arguments[index];
        if (argument.ValueKind == JsonValueKind.True) return true;
        if (argument.ValueKind == JsonValueKind.False) return false;
        return bool.TryParse(argument.ToString(), out var value) ? value : defaultValue;
    }

    private static string? OptionString(JsonElement[] arguments, int index, string property)
    {
        if (index >= arguments.Length || arguments[index].ValueKind != JsonValueKind.Object)
            return null;
        if (!arguments[index].TryGetProperty(property, out var value)
            || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
    }

    private static int OptionInt(JsonElement[] arguments, int index, string property, int defaultValue) =>
        int.TryParse(OptionString(arguments, index, property), CultureInfo.InvariantCulture, out var value)
            ? value
            : defaultValue;

    private static bool OptionBool(JsonElement[] arguments, int index, string property, bool defaultValue) =>
        bool.TryParse(OptionString(arguments, index, property), out var value)
            ? value
            : defaultValue;
}
