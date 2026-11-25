# Multi-system reference browser — Workstream A

Starting foundation: `4c15cac665e96cf9cea4a3ddd046e0c739e399d7`. The browser remains on the existing Site → Wiki → private Rules Core named-operation path.

## Bounded catalog page adapter

The existing reference API now accepts an explicit snapshot-pinned reader. Its page adapter returns a single server page, authoritative matching totals, catalog-wide category facets, and ruleset-qualified row links. It uses native entity IDs for the mounted detail surface and tuple-qualified IDs for identity outside that surface. A first-party compatibility category uses a bounded concatenation of its native category streams (condition/leveled-condition; rule/ruleChapter/rule-chapter). The displayed order is server order within each stream; it is not a global alphabetical sort. Foreign kinds are not remapped.

The active browser now passes its authorized snapshot-pinned reader explicitly to the page adapter. Each selection, URL or history context change cancels detail leases and discards incompatible index state. The selector consumes the same discovery response used by the reader. Explicit unavailable or malformed URLs fail closed. Legacy first-party paths remain readable; new native row links are qualified. A qualified catalog home is also the all-category index with `browse=1` or a search query. Recent history stores qualified IDs only in tab storage and resolves labels within the active fingerprint. Legacy history is migrated only as first-party IDs. Class playtest cards on the first-party home use at most ten class details and explicitly disclose a partial list. Contextual row summaries are unavailable rather than recovered via one private read per row.

## Core contract observations

At Core foundation revision `6a300933435c633b51f1d446fca09b9810dceb9e`, native search accepts only q, category, limit (1–100) and offset; response rows contain id, name and kind, with catalog-wide category facets. Search order is stable by native ID. Source, sort and arbitrary field filters are not supported.

Required private projection discussion with F/Core: optional safe row summaries for class-feature owner name/ID and level, class playtest version, and system/category-specific display fields with declared filter/sort capability. Additional filter operators or category-family unions must be implemented in Core if they need global semantics. Do not treat absent fields as no matches. No publication or campaign policy change is requested.

## Validation

The new fixture test exercises the adapter on all four existing fixture catalogs, identical native IDs, qualified routes, denied discovery, fingerprint mismatch, and a synthetic large catalog. It checks operation counts without making live ticket or publication claims. The existing browser tests have been updated for bounded pagination and the qualified-route parser. Full four-system hosted-browser acceptance and live ticket measurements remain pending. No private access or campaign authoring policy was changed.
