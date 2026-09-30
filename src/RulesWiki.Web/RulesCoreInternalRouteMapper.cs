namespace RulesWiki.Web;

/// <summary>
/// Owns the browser-facing Rules Wiki -> private Rules Core mapping. Browser paths remain Rules Wiki
/// contracts; only this server-side adapter knows the Core target path. No arbitrary browser path is
/// ever appended to the Site Tool-to-Tool delegation URL.
/// </summary>
public static class RulesCoreInternalRouteMapper
{
    public const string SharedInternalPrefix = "/internal/wiki/shared";

    private static readonly string[] SharedBrowserPrefixes =
    [
        "/api/rules",
        "/api/sources",
        "/api/source-admin",
        "/api/global/rules",
        "/api/workspace"
    ];

    public static bool TryMap(PathString browserPath, out string corePath)
    {
        corePath = string.Empty;
        var value = browserPath.Value;
        if (string.IsNullOrWhiteSpace(value)) return false;

        if (IsWikiReferencePath(browserPath))
        {
            // /api/wiki is a private Core route family despite retaining its historical name.
            // Core independently enforces the immediate delegated caller as rules-wiki.
            corePath = value;
            return true;
        }

        if (SharedBrowserPrefixes.Any(prefix =>
                browserPath.StartsWithSegments(prefix, StringComparison.Ordinal))
            || IsCampaignRulesPath(browserPath))
        {
            corePath = SharedInternalPrefix + value;
            return true;
        }

        return false;
    }

    public static bool IsPrivateCoreTarget(string corePath)
    {
        if (string.IsNullOrWhiteSpace(corePath)) return false;
        var path = new PathString(corePath);
        return path.StartsWithSegments(SharedInternalPrefix, StringComparison.Ordinal)
            || IsWikiReferencePath(path);
    }

    private static bool IsWikiReferencePath(PathString path)
    {
        if (path.StartsWithSegments("/api/wiki", StringComparison.Ordinal)) return true;

        var value = path.Value;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var segments = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 5
            && string.Equals(segments[0], "api", StringComparison.Ordinal)
            && string.Equals(segments[1], "campaigns", StringComparison.Ordinal)
            && Guid.TryParse(segments[2], out _)
            && string.Equals(segments[3], "wiki", StringComparison.Ordinal)
            && string.Equals(segments[4], "references", StringComparison.Ordinal);
    }

    private static bool IsCampaignRulesPath(PathString path)
    {
        var value = path.Value;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var segments = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 4
            && string.Equals(segments[0], "api", StringComparison.Ordinal)
            && string.Equals(segments[1], "campaigns", StringComparison.Ordinal)
            && Guid.TryParse(segments[2], out _)
            && string.Equals(segments[3], "rules", StringComparison.Ordinal);
    }
}
