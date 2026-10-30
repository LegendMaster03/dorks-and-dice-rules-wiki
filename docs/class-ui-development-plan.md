# Rules Wiki — class reference and customization UI development plan

## October 30: complete class reading flows

The post-deployment review found that generic option filters, equal-height card grids, and separate embedded/direct renderers prevented the class UI from working as a coherent reference. The user authorized fixes, merging, deployment review, and iteration before the next visual review.

- Patron uses a compact overview and a clearly labeled link to its complete reference. Patron and Pact catalogs have no search or level filters; Invocation search explicitly searches names and its level control shows options available by a class level.
- Pact and Invocation disclosures occupy the full reading width. Opening one never stretches an adjacent closed option. Pact level-5 improvements and published prerequisites are primary rules, not source metadata.
- Direct Patron, Pact, and Invocation routes share the embedded rule presentation. Unknown rule fields remain accessible in secondary details, and native IDs remain authoritative.
- Normal advancement exposes published class resource counts, including Invocations, cantrips, known spells, and Pact slots. Uncommon statistics remain available separately.
- Fragment click and history handling synchronizes the highlighted advancement row and expanded feature. It preserves unrelated disclosures. Returning from a full rule also restores expanded catalogs/options, filters, and reading position through session-scoped view state; no character selections or rules are stored.
- `tools/test-class-reading-experience.mjs` exercises real DOM event propagation through the mounted application, direct routes, and Back history using native-shaped fixtures. Live desktop and narrow-screen review follows the normal main validation/deployment workflow.

Status: iterative implementation workstream. This document records the current design direction, implemented foundation, and decisions that remain open. It is not approval of untested class mechanics.

## Goals and governing boundaries

- Classes are major reference experiences, not generic recursive JSON pages.
- Base class, class-specific customization systems, selectable options, and traditional subclass presets are related but distinct concepts.
- Each class can have a different customization decomposition. Warlock's Patron/Pact/Invocations model is an experiment, **not** a required three-pillar contract for other classes.
- A traditional subclass can be a **valid preset** of a class customization system. A preset can specify only subclass-defining decisions; it does not necessarily specify a whole character build or consume every remaining choice.
- Rules Core remains authoritative about feature IDs, prerequisites, level grants, selection rules, presets, and mechanical effects. Wiki never fills missing fields with assumptions from 2014, 2024, or 3.5e.
- Experimental and reference-only content must not be silently used as native runtime content. The Warlock Alpha 0.3.1 packet is a design/test fixture; native Warlock publication is a separate Rules Core content task.
- Source-history and comparison views remain available. Native class pages must not hide them or force source variations into the native schema.

## Foundation: first-pass native class reference (implemented in this patch)

- Specialized native `class` renderer, keeping the existing generic renderer for other entity types.
- Summary of class traits and character creation proficiencies.
- Level-by-level advancement table with sticky headings/level column and horizontal scrolling; displays data-backed BAB, Fortitude, Reflex, Will, and all available scalar progression fields.
- Explicit spell-slot progression and advanced per-level data disclosures for nested or uncommon mechanics.
- Feature list grouped by class level. Inline features display their mechanics immediately; separate native feature records load only if expanded, and retain their full-rule links.
- Class customization section for documented options and future structured customization systems and presets; deferred/absent subclasses are **not** presented as selectable presets.
- Accessibility groundwork: semantic table headers, native `details`/`summary`, named scroll regions, labeled level selector, keyboard-usable buttons, reduced-motion-safe navigation.
- All unknown class properties remain accessible in an additional-details section rather than being silently discarded.

The first pass is intentionally conservative. The existing `class-family-workspace` still owns source variation and comparison views; further consolidation should share presentation primitives and normalization without changing source authority.

## Second pass: native Warlock customization pilot (implemented locally)

- Confirmed against Rules Core `main` that `class.warlock`, the Fiend Patron, four Pacts, active Invocations, and class-feature records are now native. The class content remains explicitly selected for playtest and subject to change; this UI preserves that status.
- Added a generic customization presentation module that reads named systems from a future `customizationSystems` contract or the **Warlock-specific** published `pillarSystem` field. No other class is forced to use the Warlock's structure.
- Patron, Pact, and Invocation options link to their real native IDs. Details load only when expanded; large catalogs support local text filtering, avoiding a large burst of API calls.
- Class-specific feature progression now includes recorded Fiend milestones, separate grants and recovery rules, and class-related advanced values without inventing BAB, spell rules, or preset membership.
- The existing native renderer preserves explicit subclass presets when provided. **The Fiend Patron is not silently treated as a fully specified subclass preset.** Rules Core has not yet supplied a definitive preset contract.
- Spell slot progression for other native classes uses a nine-column spell-level matrix instead of an ambiguous slash-separated string.
- The feature and option disclosures retain their full-rule navigation links after data loads or errors.
- The implementation handles Rules Core's actual private reference envelope, where `rule.definition` can contain the whole native record with a nested gameplay `definition`. The distinction is covered by regression tests; the Wiki does not reinterpret source content.

## Third pass: independent customization references (implemented locally)

Rules Core is moving Patron, Pact and Invocation definitions away from base-class content. This UI pass preserves a strict separation between a class's progression and the separately defined customization rules:

- `customizationSystemIds` or an explicit `customizationSystems` array may identify independently authored native customization-system rules. The renderer loads each system **on expansion** by native ID, then displays its own description, option references and requirements. The class file does not need to contain the option definitions.
- Explicit `subclassPresetIds` may reference independent preset rules. Their rules load on expansion. A Patron alone, a legacy subclass name, or an excluded/deferred subclass marker is **not** treated as a preset.
- The existing Warlock `pillarSystem` remains a **temporary compatibility adapter** for its published `activePatronIds`, `activePactIds` and `activeInvocationIds`. The system does not derive IDs from folder structure, naming convention, or edition.
- Every referenced option is resolved through the same authenticated native-rule API and retains a direct rule link. The renderer shares a per-page promise cache across class features, systems, options, and presets.
- Unrecognized prerequisites and related rule IDs remain visible as mechanics, not silently converted into selectable options. Only explicit `optionIds`, `options` or legacy `active...Ids` create options.
- Class advancement milestone columns are dynamically derived from supplied progression data rather than hardcoding the Fiend's milestones into the universal table.

The reference-field names above are supported **presentation input shapes**, not a finalized Rules Core schema. Coordinate naming and relationship semantics with the Core content workstream before declaring them authoritative. If Core publishes a different explicit linking contract, adjust this small adapter rather than reading files or duplicating mechanics inside Wiki.

## Fourth pass: merged Warlock directory split and native option discovery (implemented locally)

Rules Core `main` now stores the Warlock base class at `native/classes/base/warlock/warlock.json`, with **separate** individual files under `patrons/`, `pacts/`, and `invocations/`. The file paths are provenance, not a Wiki API contract. The native entity IDs remain stable. The active Warlock base-class definition now supplies `selectionRules` rather than the earlier `pillarSystem` and its embedded `active...Ids` lists.

- The Warlock UI recognizes the published `selectionRules` entries (`patron`, `pact`, `invocations`) as class-specific selection categories. It does not require another class to use those categories or assume that a Patron constitutes a traditional subclass preset.
- On first expansion of each selection category, the UI queries Rules Core's **existing, authenticated, category-filtered native catalog** and loads candidate native entity records to check `parentClass === class.warlock`. Unrelated records are excluded; no filename, directory path, or ID prefix is used to establish ownership.
- Discovery is asynchronous, uses the catalog's page size limit, limits simultaneous detail reads, and shares the class page's existing native-rule request cache. The selected class remains a reference, not a character builder. If a catalog page fails or the source snapshot changes, the UI reports that the options could not be loaded instead of mixing revisions.
- The compatibility adapter is deliberately narrow because Rules Core does **not** currently provide a class-scoped option listing or authoritative `customizationSystemIds` contract. Long-term, a server-supported parent-class filter or explicit option identity list would be more efficient than reading candidate details. Do not claim the present fallback is the final query architecture.
- The new native contract retains the Warlock's rules status and progression but no longer supplies `fiendMilestones` inline. The renderer must not manufacture former columns from the Patron record; Patron features remain visible in the independent Patron definition.

The older `pillarSystem` adapter remains supported for transitional or cached content. The current `selectionRules` shape takes precedence only when a more explicit customization-system contract has not been supplied.

### Current limitations and required review

- The normal native Wiki API is still a single-rule reference API. The browser cannot display source histories in the native view until a supported source contract is available; the historical class-family workspace remains separate.
- Labels for referenced options come from IDs unless the owning system supplies explicit names; expanding an option updates its name from Rules Core. A future bulk metadata API may improve discoverability without requesting every option, but would require an approved Core contract.
- No subclass preset is generated from a Patron, Pact, or source-edition subclass name. Presets require explicit content records.
- The full UI needs in-browser responsive and accessibility acceptance against the actual hosted Rules Wiki. Local fixture tests do not establish browser integration or live API behavior. An attempted headless Chromium preview did not finish; no browser acceptance is claimed.

## Fifth pass: reading-experience remediation (implemented locally)

The initial standalone visual preview exposed structural defects: sparse trait cards, a long ungrouped feature list, a technical advancement matrix, and Warlock customization buried below the core reference. The following changes alter the reading experience rather than the game rules:

- Compact class trait strip with readable skill choices replaces equal-height nested-data cards. Only existing class data is displayed.
- **Class customization precedes advancement and the full feature catalog.** Patron, Pact and Invocations receive distinct descriptions that explain their mechanical roles in the selected Warlock alpha. The first system is open by default; additional systems expand independently and use the authenticated native option-discovery adapter.
- Common `selectionRules` metadata is presented in rule-oriented sentences (for example, the free first Pact, Patron acceptance, and level of first choice), not raw camel-case keys and boolean values. Unrecognized fields remain accessible under “Further rules and conditions.”
- The advancement table initially shows level, features, and up to three prioritized data-backed progression columns. **Show all columns** reveals every available statistic in the same table, including BAB and save progressions where published. Full per-level data remains in an expandable reference section.
- Feature groups are collapsible by level; Level 1 is open initially, and choosing a level in the progression selector opens its group while highlighting the corresponding row. Linked features still open their authoritative native definitions on demand.
- Independent options show available level and required Pact when the underlying native record publishes those values. Long option catalogs initially show 12 choices, with a show-all control and search across the entire set.
- The separate-grants section now provides readable notes for known Warlock distinctions (automatic Eldritch Blast, Mystic Arcanum, Pact slot recovery). The complete original data remains in an optional advanced section.

A regenerated, self-contained Warlock preview includes all 20 advancement levels, 1 Patron, 4 Pacts, and 38 active Invocation identities. It contains abbreviated descriptions and is **not** a live Rules Core integration or deployed Wiki preview. Local automated DOM, syntax and patch checks pass. The headless browser cannot start in the current execution environment; real desktop/mobile visual verification and full-repository integration testing are not claimed. A previous visual review already rejected the first layout, so this revision needs new acceptance before merging.

## Iterative follow-on work

### A. Shared visual language and common reference components

- Consolidate the class summary, progression, feature grouping, and class-family navigation components between native and historical source views.
- Validate the design interactively in the deployed tool, including narrow screens, nested scrolling, keyboard use, and long advancement tables.
- Preserve navigation context when following linked features and returning to a class.
- Add optional full-width reading mode when the detail pane is too constrained, without breaking the browser shell.

### B. Customization and subclass preset presentation

- Specify a native contract with Rules Core for class-owned customization system IDs, option IDs, constraints, prerequisites, levels, and preset membership. Do **not** introduce an independent Wiki rule engine.
- Represent presets as references to the same option/rule definitions that a custom configuration uses, not duplicate mechanics.
- Show which decisions a preset establishes and which remain open. Preserve traditional names, descriptions, and source relationships.
- Allow both entry paths: browse a traditional subclass preset, or explore the class's individual customization systems.
- Render class-specific composition UIs as plug-ins to the generic reference structure, not fixed global pillars.
- Keep character choices persistent only in Character Sheet; Wiki filtering/exploration is noncommittal.

### C. Warlock-specific reference pilot

- The **native** `class.warlock` record and linked features now exist under the new Warlock base-class folder. Continue using published rules, never `working/` or `reference/` fallback.
- Present Patron, Pact, and Invocation as separate Warlock systems, and make their interactions legible.
- Display the level-one free Pact separately from Invocation acquisitions and the level-five intrinsic Pact improvement.
- Keep Pact Magic, Mystic Arcanum, ordinary known cantrips, and automatic Eldritch Blast mechanically distinct.
- Preserve selected experimental progression versus alternatives **only** through an explicitly authorized, access-scoped experimental interface; do not silently mix it into native rules.

### D. Other class pilots and system integration

- Exercise the renderer with Barbarian, Bard, Cleric, Druid, Rogue, Sorcerer, and Wizard before using it as a general class standard.
- Design the custom systems of each class only after their Rules Core mechanics are defined. Avoid reverse-engineering mechanics from visual appearance.
- Later: multiclassing, cross-class choices, feats, requirements, spell resources, and compatibility with Character Sheet. Rules Wiki displays these relationships; Rules Core evaluates them.

## Testing and release gates

1. `node tools/validate-native-class-renderer.mjs` — DOM fixture tests including missing data, inline features, lazy feature and option loading, spell slots, named milestones, source status, independent system/preset references, and strict option versus prerequisite classification. Passing locally in this development branch.
2. Run existing Wiki JavaScript validators and `dotnet test` from the full repository after applying the patch. This partial local workspace does **not** contain the entire repository, so these are not claimed as passing here.
3. Confirm native class and feature links against a running Rules Core instance and authenticated Rules Wiki.
4. Manual visual and responsive review before merging or deploying. Do not bypass the usual main-branch approval.

## Explicitly open decisions

- Final Rules Core schema for customization systems and subclass presets.
- How source-reference subclass navigation and native preset navigation are unified.
- Prioritization of class-specific progression columns on mobile; a focused/full toggle is implemented as the current UI approach but not yet visually accepted.
- Whether class feature descriptions should open inline, in a dedicated side pane, or both.
- How to display experimental alternatives without confusing them with the selected rule set.

Treat these as design questions, not approved decisions.

## Sixth pass: navigation, prerequisites, and preset clarity (local implementation)

- Advancement feature links now expand the enclosing level disclosure and feature disclosure before native fragment navigation. They also synchronize the focused level and highlight in the advancement table; the actual link retains its ordinary `href` behavior.
- Standalone or discovered native options retain published `minimumLevel` and `requiredPact` metadata. The displayed option list supports text search and, when such metadata exists, reference-only filters for documented class level and required Pact. These are **not** legality, allocation, or character-building checks; unspecified metadata is not treated as an authoritative prohibition.
- Invocation systems with published Pact relationships show a compact count by listed required Pact. These relationships derive solely from native option records, not inferred names, file paths, or a universal Warlock-pillar schema.
- Explicit preset records display named constituent selections ahead of supplemental rules; the interface emphasizes that the preset defines only the choices actually specified. When no native presets are present, the interface states that absence rather than inventing a preset from the Fiend Patron.
- The offline review fixture uses 20 Warlock levels and 38 current Invocation IDs with the published minimum Warlock levels and `requiredPact` values, including Blade, Chain and Tome-specific options. Some individual option descriptions remain abbreviated in the **offline** preview; the connected renderer loads the full native records on demand.
- The local DOM suite now tests opening nested feature disclosures from progression links, direct option prerequisite preservation, Pact/level filters, relationship summaries, and explicit preset disclosure. Syntax and whitespace checks remain mandatory.

**Review limitation:** No browser screenshot or live Wiki integration acceptance is claimed for this pass. The supplied Chromium binary times out during startup. Desktop/mobile visual review must occur in a functioning browser using the self-contained preview or an integrated deployment before merge approval. The current Core contract still requires category catalog scans and ownership verification, pending a class-scoped query or explicit authoritative system membership records.

## Next pass: deployment-oriented resilience and arbitrary class ranges

- **Do not use standalone HTML as the review gate.** The class UI requires the actual hosted Wiki detail-pane shell and live Rules Core responses. User visual review takes place after a development deployment.
- Native option level filters derive their highest listed level from the owning class's published advancement/range and explicit option minima; the Warlock level-20 ceiling is not imposed on future class systems.
- Transient feature, option, preset, and linked customization-system lookup failures may be retried by closing and reopening their disclosure. The original native rule link remains available during an error.
- Local regression coverage includes class levels above 20 and two-attempt recovery from temporary private API failures.
- **Deployment boundary:** The existing `Deploy Rules Wiki` GitHub Action runs only after the `Validate Rules Wiki` workflow passes for a push to `main`. A local patch or a PR branch does not deploy to the dev Wiki. Apply this work through the normal review/merge/CI path; do not bypass the private Core tunnel or make the Wiki public.
- Dev review checklist: verify Warlock and all other native classes; expand each Warlock system against the split native catalog; inspect narrow browser pane and mobile viewport; follow a progression feature link, return to the class, test level and Pact filters, verify a transient-error state, and confirm that no generic JSON or unsupported subclass preset is shown in place of native rules.
# Warlock rule parity restoration

The native Core descriptions now retain complete play procedures and the approved October 30 feedback. The Wiki preserves paragraph breaks in class features, Pact improvements, Patron features, and spell-access rules. Invocation version and cantrip prerequisites appear with the other requirements.

Advancement rows display native `improvements` and `relatedFeatures` references alongside class grants. Related features link to their owning rule and remain distinct from base-class entitlements. This allows Patron milestones and spell grants to remain visible without duplicating grants or adding class-specific mechanics to the renderer.

Mounted-application coverage uses the restored native records and verifies recurring ASIs, Patron references, resource improvements, Talisman paragraphs, complete spell access, and the approved Psychic damage option. Tester guidance remains separate from the rules; a dedicated removable guidance system is deferred.

## Advancement navigation simplification

Remove the redundant per-level Focus selector and its extra jump link. Advancement feature links still reveal the feature and containing level group, highlight the row, preserve unrelated disclosures, and support Back navigation. No band selector is shown while only the first band is implemented.
