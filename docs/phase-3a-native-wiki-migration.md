# Phase 3A — Native Rules Wiki integration

Status: local implementation candidate, not deployed. No legacy Rules Core API adapter is included in the active Wiki stack.

## Request chain

Browser → Site Tool Host authenticated upstream → Wiki `/_rules-wiki/operations/{operation}` → Wiki's exact named-operation allowlist → Site private-tunnel ticket exchange (`rules-wiki` → `rules-core`) → pair-network private Core ingress → Core target ticket introspection with Site. No private address, capability, introspection path, or target ticket reaches browser JavaScript.

The only active operations are `getNativeRulesets`, `searchNativeRules`, and `getNativeRule`. All map to GET requests under `/api/private/rulesets`. No browser-supplied Core path, HTTP method, or arbitrary proxy is accepted. Legacy import, source variation, campaign overrides, publishing, RuleConcept, authoring, adjudication, companions and history routes are **not enabled**. The old JS modules can remain inert during migration, but must not be imported or used by `app.js`; remove them and replace retired tests in a subsequent cleanup after successful new-contract CI.

The new frontend bootstraps only from the Site Tool Host context and the three read-only operations. It uses `rulesetId`, `id`, `kind`, and the native `definition` object directly. Deep links use `/rulesets/{rulesetId}/rules/{ruleId}` under the Site Tool base path; filters use `q`, `category`, and `offset`. All rendered native values use DOM `textContent`, not unsanitized HTML. The reference library works with no authoring scopes or campaign records. It presents the available 35-record baseline without implying unfinished monsters, spells, or classes are approved.

## Configuration and deployment order

Required Wiki environment values: `ToolHost__BaseUrl`, `RulesCorePrivate__BaseUrl`. Required Core private ingress values: `RulesCore__ApiSurface=PrivateOnly`, `ToolHost__BaseUrl`, native ruleset content settings. Site must grant `ToolHosting__PrivateTunnels__rules-wiki__0=rules-core`; the Site registration and private pair network must already exist. Public Core ingress remains `PublicOnly`. The Core and Wiki Compose private overlays and deployment workflow must both include the pair network. Do not attach Core private ingress to the general Tool network.

1. Review the new Core private ingress and its unit/integration/CI security results; start it on the isolated pair network with the old Wiki not yet cut over.
2. Redeem a real Site-issued `rules-wiki` → `rules-core` private ticket and verify the Core native endpoint response; check anonymous/public failure independently.
3. Deploy the native Wiki only after Core's compatible private ingress is running; confirm the browser search, condition/rule details and direct deep-link reload through the Site Tool Host.
4. If rollback is needed, roll back the Wiki first, and then the Core private ingress; do not leave a mismatched Wiki/Core pair. Do not expose the private route publicly.

There is no legacy API fallback. Phase 3B is responsible for public consumer endpoints. Native authoring, campaign layering, source history, and other unapproved entity categories remain unavailable.
