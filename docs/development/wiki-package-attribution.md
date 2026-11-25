# Workstream F: package attribution integration

Based on Wiki 7cc79523dbfe01600ad5cd5be676ee7fe65ff21f. Core contract PR #212
(branch feature/ruleset-attribution-metadata). Complete Workstream F before starting Workstreams A–E. Start subsequent
work from the updated integration branch; these shared-file hooks are the
baseline, not pending edits requiring Workstream A before F can close. No changes to routes, private transport, renderer selection,
foreign availability guard, campaign state, or publication policy.

Core supplies optional metadata on the existing permitted descriptor.
package-attribution.js owns exact-descriptor validation, safe text and HTTPS
link rendering, displayName fallback to the actual ruleset ID, and reusable
detached attribution sections. No authored license table or per-system Wiki
copy. Older Core servers remain compatible; metadata absence is visible and
never implies a license. No browser storage or cross-user caching.

openRulesetReader discovers identity and attribution together in a single
authorized index read, exposing reader.packageDescriptor. The presentation
input preserves packageDescriptor independently of entity source and
sourcePackage. The shared generic renderer adds the package notice regardless
of entity source hook. Existing first-party home and detail views use the
snapshot-bound legacy index descriptor. Never use the legacy first-party
index for a foreign page. Foreign qualified routes remain guarded.

Workstream A should use discoverPackageContext or the active reader's
packageDescriptor to establish selector labels (packageDisplayName) and append
renderPackageAttribution(reader.context, reader.packageDescriptor) to each
authorized ruleset landing page. Use the same detached view for any shared
attribution page, only for exact authorized descriptors. Active foreign
specialized renderer integration should mount the notice once outside the
renderer body and honor the owning render lease. Do not reuse the first-party
legacy index or bypass authorization. The existing first-party hooks remain active until Workstream A replaces
or reconciles them; Workstream A owns final routing and selection. Fixture-only tests exercise attribution for all four packages without
enabling foreign packages.

For future campaign revisions, display separate inherited source notices
and modification notices obtained from Core; existing base-only context
validation deliberately rejects campaigns. No license inheritance implemented.

## Handoff and acceptance

- Catalog/navigation: consume the exact permitted descriptor's display name
  and attribution; replace the temporary foreign route guard only within
  the existing transport and context contract. No hardcoded foreign labels
  or fabricated access decisions.
- Class, creature and other structured reference rendering: use
  createPresentationInput's packageDescriptor independently of entity
  source provenance. The generic fallback already renders the notice.
  Specialized views must render it exactly once, using the owning surface's
  render lease. Do not add independent license tables or per-system copies.
- Integration/testing: verify selector, landing and detail notices for each
  available catalog, exact ID/fingerprint binding, metadata absence,
  no duplicate notices, and first-party regressions. Fixture-driven testing
  may cover unavailable foreign catalogs. Live foreign access remains
  constrained by the existing Core policies; do not alter them to run tests.
- Campaign restoration: no campaign attribution behavior is implemented
  here; use authoritative inherited notices once an actual campaign
  contract exists. Preserve package/entity provenance separation.

Metadata and fingerprint have different lifecycles: manifest-only edits do
not change the entity fingerprint. Read fresh descriptors when establishing
a reader; do not persist metadata across sessions or use an unchanged
fingerprint as proof that notices have not changed.

Workstream F does not change tool access, authorization, or publication
policy. Full multi-system browser acceptance belongs to the subsequent
integration pass, not this metadata workstream.
