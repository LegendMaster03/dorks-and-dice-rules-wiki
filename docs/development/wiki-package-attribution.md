# Workstream F: package attribution integration

Based on Wiki 7cc79523dbfe01600ad5cd5be676ee7fe65ff21f. Core contract PR #212
(branch feature/ruleset-attribution-metadata). Review and reconcile these
small shared-file hooks with the integration owner and Workstream A before
integrating. No changes to routes, private transport, renderer selection,
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
legacy index or bypass authorization. Shared-file changes here are minimal
integration proposals subject to reconciliation; Workstream A owns final
routing and selection. Fixture-only tests exercise all four licenses without
enabling foreign packages.

For future campaign revisions, display separate inherited source notices
and modification notices obtained from Core; existing base-only context
validation deliberately rejects campaigns. No license inheritance implemented.
