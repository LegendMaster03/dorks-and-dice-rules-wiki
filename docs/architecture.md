# Rules Wiki architecture

Rules Wiki is the human-facing Dorks & Dice Tool for the rules platform. The presentation layer migrated from Rules Core remains structurally the same: Rules Library browsing, detail and comparison views, Sources workspace, Rules Lawyer authoring and adjudication, campaign rule authoring, source-update review, and related administration UI all live here.

## Request path

Normal hosted traffic follows:

`browser -> Site Tool Host -> rules-wiki -> Site delegation endpoint -> rules-core`

The browser authenticates to Rules Wiki through the normal Tool Host contract. Rules Wiki redeems that ticket through `/tool-host/rules-wiki/api/introspect`. When the Site registration allows `rules-wiki -> rules-core`, introspection also supplies a short-lived delegation capability and delegation-path template. Both remain server-side.

Rules Wiki forwards its `/api/*` browser contract through the Site delegation endpoint with the server-only capability. The Site then authenticates Rules Core with a target-scoped ticket. Rules Core therefore continues receiving the user identity, global roles, campaign roles, and authorization context it already understands.

The browser never receives the Tool-to-Tool delegation capability.

## Ownership

Rules Wiki owns presentation, Embedded Module v2 lifecycle integration, browser routing/state, frontend assets, and the thin delegated backend adapter.

Rules Core owns normalized rule data, source ingestion and provenance, source grants, restricted-source filtering, global and campaign rules, Rules Lawyer authority, campaign DM authority, adjudication, immutable revisions, publication, resolution, and PostgreSQL persistence.

Rules Wiki does not have a Rules Core database, source-grant store, or parallel authorization model.

## API compatibility

The migrated frontend retains the existing `/api/*` browser contract. Rules Wiki changes the transport boundary behind that contract rather than redesigning it: calls are delegated to the existing Rules Core endpoints.

Rules Core remains the backend Tool identity `rules-core` for external API consumers. Human-facing `browserLink` values emitted by Rules Core instead identify `rules-wiki` as the Tool slug while preserving the existing tool-relative route and canonical Rules Core route identity.

## Deployment gate

Development and validation can proceed independently, but production merge/deployment is gated on Site support for an enabled headless/non-navigable Rules Core service registration. That registration must support an upstream backend, health/readiness, authentication/introspection, and delegation targeting without exposing a normal public Tool page or navigation entry.

The public Rules Wiki registration is expected to use slug `rules-wiki`, Embedded Module v2, and a delegation target allowlist containing `rules-core`.
