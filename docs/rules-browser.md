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

The index shows one logical reference row for one accessible canonical history. Cross-edition source variations remain behind that row rather than becoming parallel rows solely because they came from different editions or packages.

Rules Core groups canonical entities connected by `revision` or `rename` relationships into the same evolving history. `variant` and `reprint` relationships remain related but distinct references. Source-native type remains attached to every variation, so a history may legitimately cross categories, for example:

- 3.5e `prestigeClass`
- 5e `subclass`
- 5.5e `subclass`

A reference does not require a published `RuleConcept`. Source-only histories receive a stable Core-owned `referenceIdentity` and use `/references/{referenceIdentity}` for deep links. Published concept keys remain valid identities and continue to use their normal entity-family routes.

## Effective/default variation

The detail pane always distinguishes the displayed effective/default variation from source history.

1. If the selected global or campaign Rules Layer publication resolves the reference to an accessible source revision, that published selection is effective.
2. In campaign scope, an explicit campaign override wins over the inherited global baseline according to the existing campaign publication semantics.
3. If no published Rules Layer selection applies, Rules Core chooses a deterministic newest accessible variation from authoritative publication date and edition metadata.

The third case is an `unresolved-fallback`. It is a browsing default only. Reading it does not create or modify a Rules Layer decision, and the UI must not label it as a published ruling.

## Category membership

Cross-category histories have two browser modes:

- **Any variation** — include a reference when any accessible variation belongs to the selected category.
- **Effective in this scope** — include a reference only when its current effective/default variation belongs to the selected category.

The selected mode is stored in the `category` query parameter. The default is `any`; `category=effective` selects effective-category mode.

The row continues to display the effective category while exposing category history so a historical match is not mistaken for the current type.

## Search, facets, and filters

Search and shared reference filters are authoritative in Rules Core and operate over the complete accessible logical-reference catalog, not only the page currently loaded in the browser.

Server-backed filters are:

- Source
- Package
- Edition
- campaign override state
- category membership mode and entity category

Source, Package, Edition, entity-type, and campaign-override counts come from the reference API. Package and Edition query state remains encoded as `f.package` and `f.edition` so refresh and Back/Forward navigation preserve the filter state.

Entity-family-specific fields such as monster Size/CR or spell Level/School still use the reusable Phase 2 `client-complete` filter path. Those filters are applied only after the complete server-filtered result set has loaded. A server-backed historical Package or Edition match is never re-filtered against the effective row's Package or Edition value.

Incremental loading, complete-dataset sorting, active-filter summaries, clear/remove behavior, keyboard navigation, and responsive list/detail behavior remain owned by the Phase 2 browser framework.

## Species and Subspecies

Normal navigation exposes **Species** and **Subspecies**. It does not expose a parallel **Races** family.

For reference browsing:

- source-native `race` content is categorized under Species;
- source-native `subrace` content is categorized under Subspecies;
- native source type is still preserved on each variation;
- legacy `/races/...` links resolve to Species;
- legacy `/subraces/...` links resolve to Subspecies.

This is a browser taxonomy normalization, not a rewrite of immutable source records.

## Generic families

Known entity families use their configured columns, type-specific filters, and renderer hints. Imported or future entity types that do not yet have specialized browser configuration remain browseable through the generic fallback with Name, Type, and Source columns. Adding an unknown family must not require changing the reference API contract.

## Read versus mutation authority

Ordinary users may inspect every accessible variation in a reference history and use read-only semantic comparison. This does not grant Rules Lawyer or campaign-DM authority.

Rules Layer mutation, source administration, normalization, publication, and campaign authoring continue to use their existing authorization gates. Source grants remain independent from mutation authority.
