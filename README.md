# Dorks & Dice Rules Wiki

Rules Wiki is the separately deployed, human-facing rules browser for Dorks & Dice. It owns its Embedded Module UI and presentation state; Rules Core owns native definitions, rules semantics, mechanics, and access decisions. Rules Wiki does not maintain a second rules database or rules engine.

## Current native reference integration

The current backend implements a **read-only native reference slice**. Its browser transport accepts exactly three named operations:

| Browser operation | Private Rules Core target |
| --- | --- |
| `getNativeRulesets` | `GET /api/private/rulesets` |
| `searchNativeRules` | `GET /api/private/rulesets/{rulesetId}/rules` |
| `getNativeRule` | `GET /api/private/rulesets/{rulesetId}/rules/{ruleId}` |

The browser submits only named requests to `POST /_rules-wiki/operations/{operation}`. A server-side allowlist constructs the Core route and checks arguments. Arbitrary paths, HTTP methods, or request bodies from the browser are not forwarded. Source administration, Rules Lawyer adjudication, and campaign authoring described in historical design documents are **not implemented by this current dispatcher**.

## Authentication and transport

The Site is the Tool identity and ticket-issuance control plane. The data path is:

```text
Browser -> Rules Wiki named UI operation
        -> Rules Wiki backend
        -> private Rules Core ingress (RulesCorePrivate:BaseUrl)
```

Rules Wiki redeems its own Tool Host ticket, obtains a server-only `rules-wiki -> rules-core` private-tunnel capability, and exchanges that capability through Site for a short-lived Core-scoped target ticket. It then sends the actual Core request directly through the pair-specific private network. **Site does not proxy Core response data.** The browser never receives the private URL, tunnel capability, or target ticket. Ordinary Tool-to-Tool delegation is not an alternative route to the private Wiki API.

This service does not consume Rules Core's anonymous public `/api/rulesets` or authenticated consumer `/api/consumer/v1/rulesets` endpoints. A private transport relationship also does not bypass Rules Core's authorization checks.

See [architecture](docs/architecture.md) for the private-network and authorization requirements. Earlier UX, source-library, and authoring documents describe architectural goals or historical work, not necessarily available operations in this native reference slice.

## Development

Configure both `ToolHost:BaseUrl` (or `ToolHost__BaseUrl`) for the Dorks & Dice Site control plane and `RulesCorePrivate:BaseUrl` (or `RulesCorePrivate__BaseUrl`) for the private Rules Core origin. Then run:

```sh
dotnet test dorks-and-dice-rules-wiki.slnx
dotnet run --project src/RulesWiki.Web/RulesWiki.Web.csproj
```

The standalone shell exposes `/` and the same `/app.js` frontend. Core-backed UI requests still require a valid Site-issued Tool ticket and a working private-tunnel configuration; standalone mode does not grant anonymous Core access.

Production deployment also requires the `dorks-and-dice-rules-wiki` self-hosted runner label, its server-side environment file, and matching Site Tool/private-network registration. The application is stateless and does not own a PostgreSQL database.
