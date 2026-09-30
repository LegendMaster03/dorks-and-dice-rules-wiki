# Rules Wiki reference browser

Rules Wiki is the human-facing browser for rules and source history. Its primary browsing boundary is the Rules Core Wiki-reference API, not the resolved consumer catalog.

## API ownership

Rules Wiki uses these first-party read contracts:

- `GET /api/wiki/references`
- `GET /api/wiki/references/{referenceIdentity}`
- `GET /api/campaigns/{campaignId}/wiki/references`
- `GET /api/campaigns/{campaignId}/wiki/references/{referenceIdentity}`
- `POST /api/wiki/references/comparison`

`GET /api/rules` and the campaign `/rules` equivalents remain the effective consumer API for Character Sheet, Block Initiative, Hex Crawl, and other game Tools. Rules Wiki does not reinterpret those consumer results as the complete reference catalog.

The Wiki endpoints remain source-access scoped. Anonymous requests see only public packages. Authenticated requests additionally see restricted packages for which the current stable Dorks & Dice user ID has a Rules Core source grant. Inaccessible material is omitted from rows, history, facets, counts, detail, and comparison.

## One logical reference per row

The index shows one logical reference row for one accessible source history. Cross-edition source variations remain behind that row rather than becoming parallel rows solely because they came from different editions or packages.

Rules Core groups canonical entities connected through the transitive `revision`/`rename` history into the same evolving logical history. Direction does not prevent an older or newer history member from participating. `variant` and `reprint` relationships remain related but do not grant same-history resolution semantics and do not collapse into that evolving reference.

Accessible imported occurrences that are intentionally left without a canonical entity because reconciliation is unresolved are still browseable. Rules Core gives each such occurrence a deterministic provisional identity of the form `occurrence:{canonicalSourceOccurrenceId}`. These provisional references do not use name-based grouping and remain stable across search, detail, refresh, and deep linking while reconciliation is unresolved.

A variation has one canonical mechanical category. Terminology aliases such as Race -> Species and Subrace -> Subspecies normalize into one canonical mechanical category. Immutable source records retain their original source terminology, but the Wiki contract exposes only canonical `Category`; it does not expose a redundant presentation-level `NativeEntityType`.

A logical concept history may span mechanically distinct categories such as Prestige Class and Subclass. Those categories remain distinct. A history may therefore legitimately contain:

- 3.5e `prestigeClass`
- 5e `subclass`
- 5.5e `subclass`

A reference does not require a published `RuleConcept`. Canonical source-only histories receive a stable Core-owned `canonical:{id}` identity; unresolved reconciliation occurrences receive a stable `occurrence:{id}` identity. Both use `/references/{referenceIdentity}` for deep links. Source-only references retain `ruleConceptId = null` until an authorized Rules Lawyer deliberately accepts the existing source-normalization workflow. Published concept keys remain valid aliases and continue to use their normal entity-family routes when a Rules Layer concept exists.

## Rules Layer identity and effective/default variation

Reference browsing and Rules Layer resolution are separate facts. The reference browser exposes accessible history; the Rules Layer chooses the effective/default variation for a rules scope.

Direct source bindings remain mechanically type-coherent. Rules Core does not make an arbitrary `subclass` source directly bindable to a `prestigeClass` RuleConcept merely because their names match.

A mechanically different variation can nevertheless participate in the same Rules Layer concept when authoritative canonical `revision` or `rename` evidence establishes that it is part of that concept's evolving history. `variant` or `reprint` evidence alone does not make a variation selectable as an interchangeable effective version.

When a revision/rename history contains legacy data with more than one RuleConcept binding, the history representative is selected from the directed canonical-history structure rather than from decision creation timestamps. A RuleConcept bound to a root canonical entity is the authoritative anchor; stable concept-key ordering is used only as a deterministic compatibility fallback when legacy data does not provide a unique rooted binding. Editing a secondary concept later therefore does not silently change the Wiki's effective category.

When a published global decision on the authoritative history anchor selects an exact variation, that selected variation determines the effective category. Selecting the 3.5e variation therefore yields `prestigeClass`; selecting the 5e or 5.5e variation yields `subclass`. The historical categories remain unchanged, and the RuleConcept's original entity type remains stable anchor metadata rather than overriding the selected variation's category.

Campaign scope resolves against the campaign's pinned global baseline. A published campaign `select-source` override may choose another authoritative revision/rename-history member of the same concept, including a variation in a different mechanical category. The campaign effective category follows that selected variation. An inherited campaign continues to follow its pinned global baseline and is not silently migrated by a later global publication.

If no published Rules Layer selection applies, Rules Core chooses a deterministic newest accessible applicable variation from authoritative publication/version metadata. This is an `unresolved-fallback`: a browsing/default result only. Reading it does not create or modify a Rules Layer decision, and its effective category is the category of the selected fallback variation.

## Category membership

Cross-category histories have two browser modes:

- **Any variation** — include a reference when any accessible variation belongs to the selected category.
- **Effective in this scope** — include a reference only when its current effective/default variation belongs to the selected category.

The selected mode is stored in the `category` query parameter. The default is `any`; `category=effective` selects effective-category mode.

The row continues to display the effective category while exposing category history so a historical match is not mistaken for the current type. In Any-variation mode, source/edition metadata and family-specific browser fields come from a variation that matched the requested historical category. The effective category remains visible separately. This prevents, for example, Prestige-Class filters and columns from inspecting a 5e Subclass document merely because the Subclass is effective in the selected scope.

## Search, facets, and filters

Search and shared reference filters are authoritative in Rules Core and operate over the complete accessible logical-reference catalog, not only the page currently loaded in the browser.

Server-backed filters are:

- Source
- Package
- Edition
- campaign override state
- category membership mode and entity category

Source, Package, Edition, entity-type, and campaign-override counts come from the reference API. Package and Edition query state remains encoded as `f.package` and `f.edition` so refresh and Back/Forward navigation preserve the filter state.

Entity-family-specific fields such as monster Size/CR or spell Level/School still use the reusable Phase 2 `client-complete` filter path. Those filters are applied only after the complete server-filtered result set has loaded. In Any-variation mode, Rules Core projects those fields from the matching historical variation; in Effective mode, it projects them from the effective variation. A server-backed historical Package or Edition match is likewise not re-filtered against unrelated effective-row metadata.

Incremental loading, complete-dataset sorting, active-filter summaries, clear/remove behavior, keyboard navigation, and responsive list/detail behavior remain owned by the Phase 2 browser framework.

## Species and Subspecies

Normal navigation exposes **Species** and **Subspecies**. It does not expose a parallel **Races** family.

For reference browsing:

- `race` and `species` both canonicalize to the mechanical category `species`;
- `subrace` and `subspecies` both canonicalize to the mechanical category `subspecies`;
- immutable source records retain their original source terminology;
- legacy `/races/...` links resolve to Species;
- legacy `/subraces/...` links resolve to Subspecies.

This is terminology normalization at the rules/reference boundary, not a rewrite of immutable source records.

## Generic families

Known entity families use their configured columns, type-specific filters, and renderer hints. Imported or future entity types that do not yet have specialized browser configuration remain browseable through the generic fallback with Name, Type, and Source columns. Adding an unknown family must not require changing the reference API contract.

## Read versus mutation authority

Ordinary users may inspect every accessible variation in a reference history and use read-only semantic comparison. This does not grant Rules Lawyer or campaign-DM authority.

When a reference has a real Rules Layer `RuleConcept` target, an authorized global Rules Lawyer receives **Edit Dorks & Dice rule** and an authorized campaign DM receives **Edit campaign rule**. Those controls open the existing adjudication workflows and preserve the selected campaign scope; the Wiki browser does not implement a second mutation path.

Ordinary global readers and campaign Players do not receive mutation controls. A source-only reference never fabricates a RuleConcept target from `referenceIdentity`. An authorized global Rules Lawyer instead receives **Create/bind Dorks & Dice rule**, which sends the real source entity ID through the existing Rules Core normalization endpoint. If normalization creates or reuses a RuleConcept, Rules Wiki immediately opens that real concept in the existing global adjudication editor. Campaign-DM authority alone does not grant this global normalization action.

The comparison capability remains read-only for ordinary users with source access. When the viewer also has adjudication authority and the reference has a RuleConcept, the comparison result may offer the same transition into the existing editor.

Rules Layer mutation, source administration, normalization, publication, and campaign authoring continue to use their existing authorization gates. Source grants remain independent from mutation authority.
