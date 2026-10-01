# Rules Wiki architecture

Rules Wiki is the human-facing Dorks & Dice Tool for the rules platform. Rules Library browsing, detail and comparison views, Sources, Rules Lawyer authoring and adjudication, campaign rule authoring, source-update review, and related administration UI all live here. Rules Core remains the authoritative rules backend.

## Non-negotiable Rules Core boundary

The standing architectural rules are:

> **Rules Wiki must not consume any part of Rules Core's public/external API.**
>
> **Rules Wiki must not expose a general API or act as a Rules Core API proxy.**
>
> **Every Rules Wiki -> Rules Core request uses the explicit `rules-wiki -> rules-core` private deployment tunnel.**

These rules apply to ordinary reference reads as strongly as they apply to Rules Lawyer, source administration, and other privileged workflows.

Rules Core's public API exists for other Dorks & Dice Tools and independent consumers. A Rules Wiki requirement is never, by itself, justification for expanding that public API. If Rules Wiki needs additional semantic information, Rules Core must expose it through its internal first-party contract. Promotion of an internal capability to the public API requires a separately reviewed independent non-Wiki consumer need.

## Request path

The target data path is:

```text
Browser
  |
  v
Rules Wiki web application
  |
  | pair-specific private deployment network
  v
Rules Core private ingress
```

Site remains the identity and control plane:

1. the browser reaches Rules Wiki through the normal Site Tool Host;
2. Rules Wiki redeems its normal Tool ticket through `/tool-host/rules-wiki/api/introspect`;
3. Site returns a short-lived server-only private-tunnel source capability only when deployment policy explicitly allows `rules-wiki -> rules-core`;
4. for each Core operation, Rules Wiki exchanges that capability through Site for a short-lived Rules Core-scoped target ticket;
5. Rules Wiki sends the actual Rules Core request directly to the private Core ingress and supplies the target ticket plus the stable key-scoped Core introspection path;
6. Rules Core redeems the ticket through Site and receives trusted `PrivateTunnelSourceToolKey = rules-wiki` provenance before applying its normal domain authorization.

Site does **not** relay the Rules Wiki -> Rules Core API request. Ordinary Tool delegation and private-tunnel authorization are different mechanisms and neither implies the other.

The browser never receives the private-tunnel capability, target ticket, Core private base URL, or Core authentication headers.

## Browser/server boundary

Rules Wiki has no general browser-facing `/api/*` contract and no transparent Core relay.

The browser uses a narrow application-internal UI transport under `/_rules-wiki/operations/{operation}`. That route accepts only named operations from a finite server-side operation catalog. Browser callers can not supply an arbitrary Rules Core path, host, target Tool, authentication header, or tunnel credential.

The server-side operation catalog owns the mapping from a Wiki UI operation to a Rules Core internal route. This is an implementation boundary for the Rules Wiki web application, not a public compatibility API. Adding a new operation requires an explicit server-side mapping and must not silently expand Rules Core's public API.

A small frontend compatibility translator may temporarily map known private Core-shaped strings used by existing Wiki modules into those named UI operations during migration. Those strings never cross the network as target paths, unmapped paths fail closed, and stable public Rules Core consumer routes are intentionally not translatable. New frontend work should use named Wiki operations rather than add new Core-shaped browser routing.

## Internal does not mean authorization-free

The private tunnel identifies and restricts the first-party caller. It does not replace Rules Core's domain authorization.

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

Rules Wiki owns presentation, Embedded Module lifecycle integration, browser routing/state, frontend assets, the internal UI-operation transport, and the server-side private Core client.

Rules Core owns normalized rule data, source ingestion and provenance, source grants, restricted-source filtering, global and campaign rules, Rules Lawyer authority, campaign DM authority, adjudication, immutable revisions, publication, resolution, comparison semantics, reference identity/history semantics, and PostgreSQL persistence.

Site owns normal Tool authentication plus private-tunnel source/target authorization and target-ticket issuance. Site is not the private API data plane.

Rules Wiki does not have a Rules Core database, source-grant store, parallel authorization model, parallel rules engine, or public Rules Core client.

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

Rules Wiki is deliberately not one of those public API consumers. Its private server-side operation catalog must not map the stable public consumer contracts merely because they happen to contain similar data.

Human-facing `browserLink` values emitted by Rules Core identify `rules-wiki` as the Tool slug while preserving stable human navigation. Historical persisted browser hrefs can still contain `/tools/rules-core/...`; production rollout may retain a Site compatibility redirect from the old browser mount to `/tools/rules-wiki/...`, preserving the trailing path and query string. That redirect is browser compatibility only and has no bearing on Core API access.

## Anonymous access

Private Core operations require a Tool Host authentication context because Site issues the private-tunnel source capability during authenticated Rules Wiki introspection. Rules Wiki must not bypass that boundary by falling back to Rules Core's public API.

If anonymous Rules Library behavior is required, Site and Rules Core need an explicitly designed anonymous private-tunnel identity/capability flow that carries no user grants while retaining the pair allowlist and source-access rules. Until such a flow exists, anonymous presentation must fail closed for Core-backed operations rather than weaken the private boundary.

## Deployment

The coordinated deployment uses two Rules Core surfaces:

- the normal shared Rules Core ingress runs `RulesCore:ApiSurface=PublicOnly` for ordinary Tool consumers;
- a separate private Rules Core ingress runs `RulesCore:ApiSurface=PrivateOnly` and is attached to the pair-specific Rules Wiki/Rules Core network plus the restricted Site control-plane network required for ticket introspection.

Rules Wiki receives `RulesCorePrivate:BaseUrl` from deployment configuration and joins the pair-specific private network through `docker-compose.private-tunnel.yml`. Ordinary Tools on the shared backend network do not join that pair network.

Site deployment policy must explicitly configure `rules-wiki -> rules-core` under `ToolHosting:PrivateTunnels`. `DelegationTargets` does not grant this access and is not a substitute for the private tunnel.

The Rules Wiki repository validates both the base Compose configuration and the private-tunnel overlay. Production activation must coordinate the Site, Rules Core, and Rules Wiki changes so the private ingress and pair network exist when Wiki begins using the private client.

See Rules Core `docs/api-boundaries.md` and `docs/private-tool-tunnel-deployment.md`, and Site `docs/tool-authentication-contract.md`, for the corresponding server and control-plane contracts.
