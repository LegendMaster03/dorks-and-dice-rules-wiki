# Dorks & Dice Rules Wiki

Rules Wiki is the human-facing rules browser and authoring Tool for Dorks & Dice. It owns the Embedded Module UI that was historically hosted by Rules Core. Rules Core remains the authoritative rules service and persistence owner.

## Architecture

Browser requests use the normal Tool Host contract. The browser talks only to `rules-wiki`; Rules Wiki redeems its Tool Host ticket, keeps the returned delegation capability server-side, and delegates `/api/*` requests to `rules-core` through the Site Tool-to-Tool delegation endpoint. The browser never receives the delegation capability.

Rules Wiki has no Rules Core database and no source-grant store. Rules Core remains authoritative for source grants, restricted-source filtering, global Rules Lawyer authority, campaign roles, persistence, provenance, publication, and all game-rule domain logic.

The intended Tool registration is an Embedded Module v2 Tool with public slug `rules-wiki` and delegation target `rules-core`.

## Development

Set `ToolHost:BaseUrl` (or `ToolHost__BaseUrl`) to the Dorks & Dice Site origin. Then run:

```sh
dotnet test dorks-and-dice-rules-wiki.slnx
dotnet run --project src/RulesWiki.Web/RulesWiki.Web.csproj
```

The repository is intentionally stateless. Production deployment additionally requires the `dorks-and-dice-rules-wiki` self-hosted runner label, an environment file at `/mnt/HDDs/www/dorks-and-dice-rules-wiki/.env`, and Site Tool registration.
