# Multi-system reference browser — Workstream A

Starting foundation: `4c15cac665e96cf9cea4a3ddd046e0c739e399d7`. The browser remains on the existing Site → Wiki → private Rules Core named-operation path.

## Bounded catalog page adapter

The existing reference API now accepts an explicit snapshot-pinned reader. Its page adapter returns a single server page, authoritative matching totals, catalog-wide category facets, and ruleset-qualified row links. It uses native entity IDs for the mounted detail surface and tuple-qualified IDs for identity outside that surface. A first-party compatibility category uses a bounded concatenation of its native category streams (condition/leveled-condition; rule/ruleChapter/rule-chapter). The displayed order is server order within each stream; it is not a global alphabetical sort. Foreign kinds are not remapped.

The adapter is an intermediate integration step. The legacy browser callers still use the existing first-party full-catalog route until the application is wired to a bound reader, the foreign-route guard is reconciled, and history and in-flight state are isolated.

## Core contract observations

At Core foundation revision `6a300933435c633b51f1d446fca09b9810dceb9e`, native search accepts only q, category, limit (1–100) and offset; response rows contain id, name and kind, with catalog-wide category facets. Search order is stable by native ID. Source, sort and arbitrary field filters are not supported.

Required private projection discussion with F/Core: optional safe row summaries for class-feature owner name/ID and level, class playtest version, and system/category-specific display fields with declared filter/sort capability. Additional filter operators or category-family unions must be implemented in Core if they need global semantics. Do not treat absent fields as no matches. No publication or campaign policy change is requested.

## Validation

The new fixture test exercises the adapter on all four existing fixture catalogs, identical native IDs, qualified routes, denied discovery, fingerprint mismatch, and a synthetic large catalog. It checks operation counts without making live ticket or publication claims. Full browser integration, live ticket measurements and browser acceptance remain pending.
