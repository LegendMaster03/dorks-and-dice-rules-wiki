# Dorks & Dice Rules Wiki

Rules Wiki is the human-facing rules browser and authoring Tool for Dorks & Dice. It owns the Embedded Module UI that was historically hosted by Rules Core. Rules Core remains the authoritative rules service and persistence owner.

## Architecture

Browser requests use the normal Tool Host contract. The browser talks only to `rules-wiki`; Rules Wiki redeems its Tool Host ticket, keeps the returned delegation capability server-side, and calls `rules-core` through the Site Tool-to-Tool delegation endpoint. The browser never receives the delegation capability and never calls Rules Core directly.

**Rules Wiki does not consume Rules Core's public/external API.** Every Rules Wiki -> Rules Core operation uses the private first-party Tool-to-Tool contract. Rules Core's public API exists for other Tools and independent consumers; a Rules Wiki requirement is not justification for expanding it.

Rules Wiki may expose browser-facing `/api/*` routes of its own. Those routes terminate in Rules Wiki and are backed by the internal Rules Core integration. If Rules Wiki needs additional authoritative semantics, the corresponding Rules Core change belongs to the internal API unless a separately reviewed non-Wiki consumer independently requires the capability.

Rules Wiki has no Rules Core database and no source-grant store. Rules Core remains authoritative for source grants, restricted-source filtering, global Rules Lawyer authority, campaign roles, persistence, provenance, publication, comparison semantics, reference identity/history, and all game-rule domain logic. Internal Tool-to-Tool access does not bypass those authorization rules.

The intended Tool registration is an Embedded Module v2 Tool with public slug `rules-wiki` and delegation target `rules-core`.

See `docs/architecture.md` for the normative integration boundary.

## Development

Set `ToolHost:BaseUrl` (or `ToolHost__BaseUrl`) to the Dorks & Dice Site origin. Then run:

```sh
dotnet test dorks-and-dice-rules-wiki.slnx
dotnet run --project src/RulesWiki.Web/RulesWiki.Web.csproj
```

The repository is intentionally stateless. Production deployment additionally requires the `dorks-and-dice-rules-wiki` self-hosted runner label, an environment file at `/mnt/HDDs/www/dorks-and-dice-rules-wiki/.env`, and Site Tool registration.
