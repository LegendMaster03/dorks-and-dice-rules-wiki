# Rules Wiki architecture

Rules Wiki is the human-facing Dorks & Dice Tool for the rules platform. The presentation layer migrated from Rules Core remains structurally the same: Rules Library browsing, detail and comparison views, Sources workspace, Rules Lawyer authoring and adjudication, campaign rule authoring, source-update review, and related administration UI all live here.

## Non-negotiable Rules Core API boundary

Rules Wiki has a privileged first-party Tool-to-Tool relationship with Rules Core.

The standing architectural rule is:

> **Rules Wiki must not consume any part of Rules Core's public/external API. Every Rules Wiki -> Rules Core request uses the private delegated Tool-to-Tool API.**

This is the core premise of the Rules Wiki/Rules Core split. It applies to ordinary reference reads as strongly as it applies to Rules Lawyer, source-administration, and other privileged workflows.

Rules Core's public API exists for other Dorks & Dice Tools and independent consumers. A Rules Wiki requirement is never, by itself, justification for expanding that public API. If Rules Wiki needs additional semantic information, Rules Core must expose it through the internal first-party contract. Promotion of an internal capability to the public API requires a separately reviewed independent non-Wiki consumer need.

Rules Wiki may expose its own browser-facing `/api/*` routes. Those routes belong to Rules Wiki and terminate at Rules Wiki. The server-side Rules Wiki adapter then calls Rules Core through the internal Tool-to-Tool boundary. The browser-facing Rules Wiki route and the Rules Core internal route do not need to share a path or DTO.

If a Rules Core public endpoint happens to provide similar data, Rules Wiki still does not call it. Rules Core should reuse the same application/domain services behind its internal and public boundaries rather than making Rules Wiki depend on the public HTTP contract.

## Request path

Normal authenticated hosted traffic follows:

`browser -> Site Tool Host -> rules-wiki -> Site delegation endpoint -> rules-core internal API`

The browser authenticates to Rules Wiki through the normal Tool Host contract. Rules Wiki redeems that ticket through `/tool-host/rules-wiki/api/introspect`. When the Site registration allows `rules-wiki -> rules-core`, introspection also supplies a short-lived delegation capability and delegation-path template. Both remain server-side.

Rules Wiki calls Rules Core only through that delegated server-side path. The Site authenticates Rules Core with a target-scoped ticket so Rules Core receives the user identity, global roles, campaign roles, and authorization context it already understands.

The browser never receives the Tool-to-Tool delegation capability and never calls Rules Core directly.

## Internal does not mean authorization-free

The Tool-to-Tool boundary identifies and restricts the first-party caller. It does not replace Rules Core's domain authorization.

Rules Core remains responsible for enforcing, as applicable:

- source grants and restricted-source filtering;
- campaign membership;
- global Rules Lawyer authority;
- campaign DM/editor authority;
- publication and adjudication rules;
- source normalization and administration permissions;
- all other Rules Core domain invariants.

Rules Wiki may hide or expose controls according to returned capabilities, but UI visibility is never an authorization boundary.

## Ownership

Rules Wiki owns presentation, Embedded Module v2 lifecycle integration, browser routing/state, browser-facing API shape, frontend assets, and the thin delegated backend adapter.

Rules Core owns normalized rule data, source ingestion and provenance, source grants, restricted-source filtering, global and campaign rules, Rules Lawyer authority, campaign DM authority, adjudication, immutable revisions, publication, resolution, comparison semantics, reference identity/history semantics, and PostgreSQL persistence.

Rules Wiki does not have a Rules Core database, source-grant store, parallel authorization model, or parallel rules engine.

## Contract ownership

Rules Wiki-specific Core contracts are internal first-party integration contracts. This includes, without limitation:

- accessible reference catalog/search/facets;
- reference detail and source/history views;
- semantic source-version comparison used by the Wiki;
- class/subclass/prestige-class relationship support;
- presentation projections that are semantically unsafe for the frontend to derive;
- Rules Lawyer and campaign-authoring support;
- normalization and source-version review;
- source browsing and administration;
- capability/scope information used to render authorized workflows.

These contracts may evolve with Rules Wiki as long as Rules Core remains authoritative for their semantics and authorization. They are not part of Rules Core's stable external compatibility promise.

## Public Rules Core API

Rules Core remains the backend Tool identity `rules-core` for non-Wiki API consumers such as Character Sheet, Hex Crawl, Block Initiative, and future Tools.

Rules Wiki is deliberately not one of those public API consumers.

Human-facing `browserLink` values emitted by Rules Core identify `rules-wiki` as the Tool slug while preserving stable human navigation. Historical persisted browser hrefs can still contain `/tools/rules-core/...`; production rollout therefore requires a Site compatibility redirect from the old browser mount to `/tools/rules-wiki/...`, preserving the trailing path and query string. The redirect is browser compatibility only and does not turn Rules Wiki into a public Rules Core API consumer.

## Anonymous access

The current Site Tool Host proxies anonymous browser requests directly to Tools that allow anonymous use, but it issues Tool-to-Tool delegation capabilities only from an authenticated introspection context. The repository implementation intentionally does not bypass that boundary. Therefore anonymous Rules Wiki API traffic can not reach Rules Core until Site provides a first-party anonymous delegation mechanism that carries no user identity or grants while retaining the delegation allowlist and normal upstream protections.

This is a production compatibility gate if the existing anonymous Rules Library behavior is retained. It is not a reason to call Rules Core's public API or to move source access or authorization state into Rules Wiki.

## Deployment gate

Development and validation can proceed independently, but production merge/deployment is gated on Site support for an enabled headless/non-navigable Rules Core service registration. That registration must support an upstream backend, health/readiness, authentication/introspection, and delegation targeting without exposing a normal public Tool page or navigation entry.

The public Rules Wiki registration is expected to use slug `rules-wiki`, Embedded Module v2, and a delegation target allowlist containing `rules-core`.

Before rollout, Site must also provide the historical browser-route redirect above and resolve anonymous delegation if Rules Wiki remains anonymously accessible.

See the Rules Core `docs/api-boundaries.md` document for the corresponding normative server-side classification.
