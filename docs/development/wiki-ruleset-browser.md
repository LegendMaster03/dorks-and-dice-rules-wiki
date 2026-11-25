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

### Browser integration and operation budgets

The mounted-browser regression uses the existing fixture manifest and one additional verbatim D&D 5e `race.human` record from Core revision `6a300933435c633b51f1d446fca09b9810dceb9e`, `data/rulesets/dnd-5e/native/character-origins.json`. Fixture authorization and fingerprints are simulated; they are not production grants or published fingerprints.

A fresh foreign catalog home uses one discovery and one limit-1 facet read (two named operations), without fetching the full index. A normal category page uses one search operation plus the selected detail read; first-party compatibility families use at most three category streams. Further pages are explicit. A retained selection avoids a redundant detail read. The first-party home may additionally make one class-page read and up to ten class-detail reads; recent labels may require up to eight reads on a fresh snapshot. The adapter scale test checks that a 1,000-plus-record catalog still uses one operation for a 25-row all-category page. The private dispatcher performs one ticket exchange per named operation, so these counts also describe expected exchanges; live traffic measurements are not available in this fixture environment.

The additional browser regression covers independent navigation, category terminology, duplicate native IDs, qualified routes, cross-catalog history, denied discovery, and a delayed search during catalog switching. Existing class and monster renderer regressions remain required. Workstream F/Core must supply authoritative display metadata if absent; the selector falls back to the authorized ID. G remains responsible for authoritative campaign revisions and resolution. No campaign editing has been restored.
