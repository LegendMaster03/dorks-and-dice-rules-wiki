# Rules Wiki UI/UX development plan

## Purpose

Rules Wiki should become the primary human-facing rules reference for Dorks & Dice. Its job is to make the rules platform fast to browse, easy to understand, and practical at the table without duplicating rules semantics that belong in Rules Core.

The closest existing interaction model is 5e.tools: dense content navigation, fast search and filtering, list/detail browsing, type-specific presentation, deep-linkable records, compact controls, and specialized pages for content families such as classes and monsters.

Rules Wiki should independently reimplement the useful UI/UX patterns of that model while extending them for Dorks & Dice requirements that 5e.tools does not need to solve:

- one conceptual rule may have several accessible edition/source versions;
- users may compare those versions semantically;
- compatible differences may already have been resolved by Rules Core;
- conflicting differences may require a global or campaign ruling;
- campaign scope may inherit from a published Dorks & Dice baseline or override it;
- the UI must support materially different edition families instead of assuming all content is 5e-shaped;
- monster/stat-block presentation should use the cleaner D&D 5.5e-style information hierarchy already partially implemented in Rules Wiki.

The central product principle is:

> **Rules Core owns rules. Rules Wiki owns how people find, read, compare, and resolve them. 5e.tools is a UI/UX reference, not a runtime dependency or content source.**

A second, equally important integration principle is:

> **Rules Wiki never consumes Rules Core's public/external API. Every Rules Wiki -> Rules Core request uses the private first-party Tool-to-Tool API.**

This is a standing architectural rule. Rules Core's public API exists for other Tools and independent consumers. A Rules Wiki requirement is never, by itself, justification for expanding that public API.

## Current repository baseline

This plan is an evolution of the current Rules Wiki architecture rather than a rewrite.

The repository already provides important foundations:

- Rules Wiki is a separate application from Rules Core;
- the normal hosted request path is `browser -> Site Tool Host -> Rules Wiki -> Site delegation -> Rules Core internal API`;
- the browser-facing Rules Wiki `/api/*` contract terminates in Rules Wiki and is backed by the private delegated Rules Core Tool-to-Tool API;
- Rules Wiki does not consume Rules Core's public/external API;
- the Site owns the global Dorks & Dice navigation ribbon, authentication shell, and footer;
- Rules Wiki can use the full-bleed Embedded Module body between the Site ribbon and footer;
- Rules Wiki already owns browser routing, client-side state, frontend assets, presentation, and rendering;
- the Rules Library already uses a list/detail browser with incremental loading;
- stable deep links exist for known content families and generic imported families;
- browser back/forward navigation is already supported;
- campaign scope can be represented in browser route/query state;
- the top-level Rules Wiki navigation is already organized broadly around Players, Rules, Dungeon Masters, Sources, and Adjudication;
- specialized renderers already exist for monsters, spells, classes, subclasses, prestige classes, species, feats, items, conditions, skills, and general rules;
- the monster renderer already uses a D&D 5.5e-inspired presentation grammar;
- source versions already appear as adjacent detail tabs;
- semantic version comparison already exists in the rule detail surface;
- authorized users can transition from a rule or comparison directly into global or campaign adjudication;
- Rules Lawyer, campaign rules, Sources, source administration, normalization, and version-review capabilities already exist;
- the explicit frontend render lifecycle avoids application-owned `MutationObserver` behavior;
- the existing full-bleed layout work is opt-in to Rules Wiki and does not change the layout of other Tools.

The primary mismatch is that much of the current UI still reflects its origin as the Rules Core administration/application frontend. The backend split is complete enough that the UI can now be designed around human rules-reference tasks instead of backend concepts.

## Hard architectural invariants

1. Rules Core remains authoritative for normalized rule data, source ingestion, provenance, source grants, edition relationships, global rules, campaign rules, semantic comparison, adjudication, publication, authorization, and persistence.
2. Rules Wiki must not develop a parallel rules engine, comparison engine, source-access model, campaign-rules model, or authorization model.
3. Rules Wiki may perform presentation-only transformation, ordering, formatting, local view state, responsive composition, route state, caching, and interaction logic.
4. If the UI needs semantic information that Rules Core does not expose, add or extend the **private Rules Wiki Tool-to-Tool Rules Core contract** rather than inferring authoritative rules behavior in the frontend.
5. 5e.tools is a design and interaction reference only.
6. Rules Wiki must not require a browser connection to 5e.tools, import 5e.tools runtime code as an application dependency, fetch 5e.tools content at runtime, or treat 5e.tools as an authoritative data service.
7. Existing Rules Core import/source capabilities remain independent of this UI plan even when a source happens to use a 5e.tools-compatible schema.
8. The Dorks & Dice Site owns the global navigation ribbon, account/authentication shell, and footer.
9. Rules Wiki owns the entire application surface between the Site ribbon and footer when hosted in full-bleed mode.
10. Rules Wiki UI work must not change the layout or hosting behavior of other Tools unless a separately reviewed Site change explicitly makes a reusable capability opt-in.
11. Existing stable browser routes and deep links should remain valid unless an explicit compatibility redirect is provided.
12. Browser refresh and back/forward navigation must preserve meaningful route state rather than silently resetting to a default view.
13. Source visibility, campaign membership, and adjudication authority must always be enforced server-side. Hiding or showing controls is not an authorization boundary.
14. Published rules remain distinct from source evidence and unpublished authoring state.
15. A rule that exists in multiple source editions should normally appear once in the conceptual browser list, with source/edition alternatives exposed in the detail context.
16. Unknown or newly imported entity families must remain browsable through a generic fallback even before they receive a specialized renderer.
17. Responsive behavior must be based on Rules Wiki's usable hosted width, not assumptions about a standalone viewport.
18. Keyboard navigation, focus visibility, accessible names, and non-color state indicators are required product behavior rather than optional polish.
19. New UI must preserve light/dark compatibility through host variables rather than creating an isolated color system.
20. Edition-specific presentation must not silently reinterpret another edition's mechanics. Rules Core supplies semantics; Rules Wiki chooses how to display them.
21. 3e/3.5e content must not be forced into 5e/5.5e assumptions merely to reuse a renderer.
22. Do not merge implementation branches to `main` without explicit authorization.
23. Rules Wiki must not call any Rules Core public/external API endpoint. Every Rules Wiki -> Rules Core operation must cross the existing private delegated Tool-to-Tool boundary.
24. A Rules Wiki-only need must never expand Rules Core's stable public API. Wiki-specific browsing, history, comparison, relationship, presentation-projection, authoring, and administration contracts are internal first-party contracts.
25. Promotion of an internal Rules Core capability to the public API requires a separately reviewed independent non-Wiki consumer need. UI convenience is not sufficient justification.

## 5e.tools reference-design boundary

The 5e.tools repository is useful because it demonstrates a mature information architecture for a dense tabletop rules reference.

Rules Wiki should borrow interaction concepts where they fit the Dorks & Dice product:

- grouped top navigation by user-facing content category;
- dense list/detail browsing;
- search as a primary control rather than a secondary form;
- type-specific sortable list columns;
- rich, type-specific filtering;
- compact result rows optimized for scanning;
- persistent selected-item detail;
- deep-linkable selected records;
- specialized content layouts rather than one universal document card;
- class/subclass-specific navigation and comparison surfaces;
- stat-block-specific presentation;
- optional reading/reference conveniences such as pinned records, comparison views, and focused reading where they provide real value;
- responsive composition that preserves fast browsing rather than simply stacking every desktop panel vertically.

Rules Wiki should not attempt feature-for-feature cloning where the feature belongs to a different product responsibility. Examples include 5e.tools-specific content management, prerelease/homebrew managers, Foundry/Roll20 integration, offline-cache management, DM Screen ownership, and utilities that Dorks & Dice already handles elsewhere or does not need.

Parity means:

> When Rules Wiki and 5e.tools solve the same user task, Rules Wiki should aim for comparable efficiency and clarity. It does not mean reproducing every 5e.tools page or subsystem.

Prefer independent implementation using Rules Wiki's existing components and contracts. If code is ever directly copied or substantially adapted from the MIT-licensed reference repository, preserve the required license notice and attribution for that code.

## Product model

The user-facing model should become:

```text
Dorks & Dice Site
  |
  +-- global ribbon / account / mode
  |
  v
Rules Wiki
  |
  +-- Content navigation
  |     +-- Players
  |     +-- Rules
  |     +-- Dungeon Masters
  |     +-- References / other content families as needed
  |
  +-- Reference browser
  |     +-- Search
  |     +-- Sort
  |     +-- Filters
  |     +-- Dense result list
  |     +-- Selected rule detail
  |
  +-- Rule detail context
  |     +-- Effective Dorks & Dice / campaign rule
  |     +-- Source edition versions
  |     +-- Cross-edition comparison
  |     +-- Provenance
  |
  +-- Authorized resolution
  |     +-- Global Rules Lawyer
  |     +-- Campaign override
  |
  +-- Sources / maintenance
        +-- Source Library
        +-- Imports
        +-- Source administration
        +-- Version/update review
```

The normal browsing path should dominate the product visually. Authoring and maintenance remain available without making ordinary users reason about backend layers before they can look up a rule.

## Core UI archetypes

Rules Wiki should converge on a small number of reusable page archetypes rather than designing every entity family independently.

### 1. Reference browser

Default for most rule families.

```text
+--------------------------------------------------------------+
| Rules Wiki navigation                                       |
+----------------------+---------------------------------------+
| Search / Filters     | Selected rule                         |
| Sort columns         |                                       |
|----------------------| Effective / source tabs / compare     |
| Dense result list    | Type-specific renderer                |
|                      |                                       |
|                      | Context / provenance                  |
+----------------------+---------------------------------------+
```

Families likely to use this directly include spells, feats, backgrounds, species/races, items, conditions, skills/competencies, general rules, and many imported/third-party content families.

### 2. Class family workspace

Classes, subclasses, and prestige classes need a dedicated composition rather than a generic detail card.

It should support:

- class selection/search;
- class summary and progression/table data;
- class features organized by level;
- subclass selection/tabs;
- subclass feature alignment with class progression;
- prestige-class progression and prerequisites;
- subclass or prestige-class comparison where useful;
- edition/source tabs and Dorks & Dice effective-rule context;
- deep linking to a class, subclass, prestige class, or important feature;
- responsive collapse into a usable single-pane/drill-in flow.

The workspace must be able to represent both 5e/5.5e class structures and 3e/3.5e structures such as BAB, multiple save progressions, skill points/class skills, prerequisite-heavy prestige classes, and edition-specific spellcasting progressions.

### 3. Stat-block workspace

Monsters and future stat-block-like entities use a dedicated renderer.

The D&D 5.5e-inspired hierarchy is the preferred modern presentation grammar where normalized values permit it:

- name / type / size / alignment;
- AC, HP, Speed, Initiative;
- ability scores shown as score and modifier, with save information where applicable;
- defenses, senses, languages, CR/XP/proficiency, gear;
- traits/spellcasting;
- actions, bonus actions, reactions;
- legendary/mythic/lair/regional sections;
- unknown additional mechanics preserved rather than dropped.

Older-edition mechanics such as touch/flat-footed AC, BAB, grapple, DR, SR, miss chance, or edition-specific attack structures must remain visible when Rules Core supplies them. The visual grammar may modernize readability, but it must not erase edition mechanics.

### 4. Reading/document workspace

Long-form rules, source documents, quick-reference material, or book-like records may need a reading-focused surface with a constrained readable measure and optional outline/navigation.

Full-width hosting must not imply full-width prose lines.

### 5. Comparison workspace

Comparison is a first-class extension of the detail surface, not a separate developer tool.

It should support:

- selecting two accessible source/edition versions;
- clear edition/source labels;
- unchanged content suppressed or summarized;
- additions/omissions/compatible differences distinguished from contradictions;
- type-specific visual comparison where it improves comprehension;
- a direct authorized transition into adjudication when a ruling is needed.

### 6. Adjudication workspace

Adjudication should be task-oriented and contextual.

The user should arrive with the rule/concept already selected whenever possible. The UI should explain:

- what the current published Dorks & Dice or campaign rule is;
- which source versions are relevant;
- what actually differs;
- whether Rules Core considers the difference automatically compatible;
- what decision is being proposed;
- what will remain unpublished until an explicit publish action;
- which scope is being changed.

Do not expose storage terminology when task language is sufficient.

### 7. Source/maintenance workspace

Source administration remains distinct from ordinary reference browsing.

It may use denser administrative patterns, but should still share the same visual system and interaction primitives. Source records are evidence/provenance; they are not presented as if they are automatically the effective table rule.

## Rules Core internal Tool-to-Tool contract boundary

Rules Wiki should ask Rules Core for enough semantic information to render the interface efficiently, but every such request uses the **private first-party Rules Wiki -> Rules Core Tool-to-Tool API**.

Rules Wiki does not use Rules Core's public/external consumer API, even when a public endpoint happens to expose similar data.

Preferred contract direction:

```text
Rules Core internal Rules Wiki contract
  returns semantic data + stable identity + facets + relationships + provenance
        |
        v
Rules Wiki
  chooses layout + controls + density + renderer + route state
```

Examples of valid **internal** Rules Core additions when UI work exposes a gap:

- filter facets that are expensive or semantically unsafe to derive client-side;
- stable sort fields;
- parent/child relationships such as class -> subclass or class -> prestige-class prerequisites;
- edition/source identities;
- comparison semantics;
- effective scope/ruling state;
- readable relationship metadata;
- pagination/incremental-load totals;
- capability/authority state;
- presentation projections such as authoritative feature acquisition levels when source-native encodings are unsafe for Rules Wiki to interpret.

These additions remain private first-party contracts unless a separately reviewed non-Wiki consumer independently requires them.

Examples that should remain Rules Wiki concerns:

- which pane is open;
- active tab;
- selected-row styling;
- column width;
- keyboard shortcuts;
- scroll position;
- responsive drill-in state;
- whether provenance is collapsed;
- labels and instructional copy;
- stat-block visual hierarchy;
- list density;
- local sorting only when Rules Core has already supplied the complete bounded set and semantic ordering is not implied.

If a Rules Core change is required, use a separate Rules Core branch/PR and change the internal Tool-to-Tool contract. Do not add or extend a public Rules Core API solely for Rules Wiki. Do not duplicate missing backend behavior locally merely to unblock a UI phase.

Rules Core may reuse application/domain services behind its public and internal HTTP surfaces. That implementation reuse does not make the public API a valid Rules Wiki dependency.

## Navigation architecture

The Rules Wiki top navigation should remain compact and directly attached to the hosted content surface.

The target hierarchy should be driven by user intent and available content rather than source-system internals.

Initial content groups should continue from the current structure and be refined through testing:

- **Players** — Species/Races, Classes, Subclasses, Prestige Classes, Backgrounds, Feats, Options & Features, Skills/Competencies, Spells, and Items where player-oriented access is useful;
- **Rules** — All Rules/Rules Glossary, Conditions, House Rules, general rule families, tables/reference material when available;
- **Dungeon Masters** — Bestiary and DM-facing rule families;
- **Sources** — Source Library and source-related maintenance according to capability;
- **Adjudication** — Rules Lawyer, cross-version review, and campaign-rules authoring according to authority.

Do not expose a navigation item merely because a backend endpoint exists.

Unknown dynamic entity families should remain reachable through a generic discovery mechanism rather than forcing every imported family into permanent navigation.

Global omniselect/omnisearch may be added later as a direct content jump, but it must search Rules Core-backed Rules Wiki content rather than 5e.tools.

## Browsing and filtering model

### Search

Search should be the dominant control at the top of each result list. It must:

- react quickly enough for iterative lookup;
- preserve family and scope;
- be represented in route state when a shareable/recoverable filtered state is useful;
- provide a clear reset path;
- retain keyboard focus behavior;
- avoid blocking the detail pane while a new result slice loads.

### Sorting

Each entity family should define useful sortable columns rather than relying on name-only ordering.

| Family | Candidate sort fields |
| --- | --- |
| Monster | Name, CR, Type, Size, Source/Edition |
| Spell | Name, Level, School, Casting Time, Source/Edition |
| Class | Name, Hit Die, Primary Ability or progression metadata, Source/Edition |
| Subclass | Name, Parent Class, Source/Edition |
| Prestige Class | Name, Prerequisite summary, progression metadata, Source/Edition |
| Feat | Name, Category, Prerequisite, Source/Edition |
| Species/Race | Name, Size, Speed, Source/Edition |
| Item | Name, Type, Rarity, Value/Weight where meaningful, Source/Edition |
| Condition | Name, Source/Edition |
| Skill/Competency | Name, Ability/Family, Source/Edition |

Sorting semantics must come from Rules Core where the complete result set is not present client-side.

### Filtering

Filtering is the largest ordinary-browsing parity gap and should become type-specific.

Shared filter families may include:

- source/package;
- game edition;
- campaign override/inheritance state;
- content family/type;
- access/source availability where appropriate.

Entity-specific filters may include:

- monster CR/type/size/environment/tags;
- spell level/school/classes/casting time/range/components/duration/concentration/ritual;
- class/subclass/prestige-class relationships and feature-level information;
- 3.xe class skill/BAB/save/caster progression metadata where useful;
- item type/rarity/attunement/property;
- feat category/prerequisite;
- species size/speed/traits;
- competency family/ability/mechanic profile.

Rules Core should expose facets or query parameters through the internal Rules Wiki contract when filtering the full authoritative set requires server knowledge.

Filters should use progressive disclosure. The list should not permanently sacrifice a large sidebar unless testing proves that is more efficient for a specific workspace.

## Route and state model

Browser state should remain reconstructible from a stable Tool-relative route where practical.

Preserve:

- collection routes;
- selected-concept deep links;
- campaign scope;
- browser back/forward behavior;
- direct refresh of selected records;
- generic routes for unknown entity families.

Add route state selectively for filters/search/sort when doing so improves recoverability or link sharing without creating unreadable URLs.

Transient presentation state such as an open disclosure, hover preview, or resized pane does not need to become URL state.

## Source and edition presentation

A conceptual rule should normally appear once in the browser index.

The detail surface should distinguish:

1. the effective Dorks & Dice or campaign rule;
2. accessible source/edition versions;
3. source provenance;
4. the relationship between the effective rule and those source versions.

Edition/source tabs should prefer human-readable edition labels and disambiguate with source/package only when necessary.

Do not imply that newer publication date automatically wins. Do not present a source record as the effective rule merely because it is selected for inspection.

## Cross-edition comparison

Comparison is a deliberate Rules Wiki extension beyond the ordinary 5e.tools reference-browser model.

The target flow is:

```text
Open rule
   |
   +-- Effective
   +-- 3e
   +-- 3.5e
   +-- 5e
   +-- 5.5e
   +-- Compare
            |
            +-- choose two versions
            +-- inspect semantic differences
            +-- if authorized and needed: Resolve / Edit ruling
```

Comparison should eventually support entity-aware presentation where generic key/value diffing is insufficient.

Examples:

- monster stat changes shown in stat-block context;
- spell field changes aligned by casting/range/duration/rules sections;
- class feature additions/removals aligned by level;
- subclass/prestige-class changes aligned under the relevant class progression;
- 3e -> 3.5e changes in skills, feats, combat statistics, spell fields, or prerequisite structures;
- item property changes grouped by mechanical category.

The comparison UI must render Rules Core comparison semantics returned through the internal Tool-to-Tool contract; it must not independently decide whether a difference is compatible, contradictory, or automatically resolvable.

## Adjudication and campaign resolution

Rules Wiki should make resolution feel like a continuation of browsing rather than entry into a separate backend console.

Preferred flow:

```text
Browse concept
   -> inspect effective rule
   -> inspect edition versions
   -> compare differences
   -> open ruling editor with concept/context already selected
   -> make decision
   -> save draft
   -> explicit publish remains separate
```

Global Rules Lawyer authority and campaign-DM authority remain distinct.

Campaign views should clearly distinguish:

- pinned global baseline;
- inherited current rule;
- campaign override if one exists;
- unpublished campaign change;
- resulting published campaign rule.

The UI should infer scope from the current browser/campaign context whenever possible rather than requiring users to choose backend-like effective-rule scopes redundantly.

## Edition-family presentation strategy

Rules Wiki should use shared interaction patterns without pretending every edition has the same mechanical shape.

### 5e / 5.5e

The first human-testing target. These editions establish the initial reference-browser, class/subclass, spell, feat, species, background, item, condition, and stat-block presentation patterns.

### 3.xe

For this plan, **3.xe means D&D 3e and D&D 3.5e**. After the 5e/5.5e player-reference surface is stable, Rules Wiki should deliberately test the architecture against 3.xe before bestiary completion.

High-value 3.xe concepts include:

- base classes and prestige classes;
- BAB and multiple save progressions;
- skill ranks, class/cross-class behavior, and skill families such as Craft, Knowledge, Perform, and Profession;
- feat categories, prerequisite chains, and feat relationships;
- spell levels that vary by class/list;
- school/subschool/descriptors, saving throws, spell resistance, and richer component/cost fields;
- weapon/armor categories, enhancement/special properties, charges, costs, and other item mechanics;
- combat/reference mechanics such as touch AC, flat-footed AC, grapple, damage reduction, spell resistance, and miss chance.

The purpose of the 3.xe phase is not merely to add more labels. It must prove that the shared browser and renderer architecture can display a materially different rules family without flattening it into 5e semantics.

## Stat-block presentation

The existing monster renderer is a foundation, not temporary UI.

Continue using the D&D 5.5e-style ability presentation and information hierarchy across source editions where Rules Core supplies normalized values.

The preferred ability display is conceptually:

```text
STR 18 (+4)
DEX 14 (+2)
...
```

with save information integrated cleanly rather than returning to older stat-block layouts merely for visual parity with 5e.tools.

For 3.xe and other older editions, edition-specific combat statistics must remain visible even when the surrounding stat-block presentation uses the cleaner modern hierarchy.

5e.tools remains useful for browsing density, entity selection, filtering, tabs, and general stat-block reference behavior. The final Rules Wiki stat-block visual grammar may deliberately differ.

## Responsive and embedded behavior

Rules Wiki is hosted inside the Dorks & Dice Site and must respond to the width of its available embedded canvas.

Desktop/wide layouts should use width for parallel information, not for excessively long text lines.

Preferred responsive progression:

```text
Wide
  list | detail | optional contextual comparison/provenance affordance

Medium
  list | detail
  filters collapsed

Narrow
  list -> detail drill-in
  back-to-list preserves filters/search/selection
```

Use container-aware behavior where practical so Rules Wiki responds correctly even when the physical viewport is wide but the Tool's actual canvas is constrained.

The Site ribbon and footer remain outside Rules Wiki ownership. Other Tools must not inherit Rules Wiki-specific spacing, width, or viewport assumptions.

## Visual system

The target is not a literal visual clone of 5e.tools. It is a Dorks & Dice reference application using comparable information density and interaction efficiency.

Guidelines:

- keep the Rules Wiki top nav visually attached to the application body;
- use the full hosted canvas for functional columns;
- constrain long prose to a readable measure;
- prefer flat/divided workspace surfaces over nested card stacks;
- use borders, spacing, and typography to express hierarchy before adding decorative containers;
- reserve badges for state/status;
- keep list rows dense enough for rapid scanning;
- preserve host light/dark color variables;
- use consistent hover, selected, active, disabled, error, loading, and focus states;
- avoid backend terminology where plain task language is available;
- hide maintenance complexity until it is relevant;
- preserve attribution/provenance where source/license requirements or user understanding require it.

## Accessibility and keyboard behavior

Every phase must preserve or improve:

- semantic landmarks;
- accessible names for nav, search, filters, lists, and detail tabs;
- visible focus;
- keyboard navigation through result lists;
- selected-row state announced with appropriate semantics;
- tab semantics for version/compare views;
- accessible disclosure behavior;
- no color-only distinction for ruling/source/status state;
- reduced-motion support;
- usable zoom/reflow at narrow widths.

Keyboard shortcuts should remain discoverable rather than mandatory knowledge.

## Performance model

Rules Wiki should feel immediate even when Rules Core contains a large catalog.

Continue to prefer:

- incremental catalog loading;
- bounded detail requests;
- facets on initial query rather than repeated payloads;
- server-side filtering/sorting for large authoritative sets;
- cancellation/stale-request protection when the user changes selection quickly;
- cached presentation-safe data where it does not risk stale authority state;
- lazy loading for secondary provenance, comparison, or maintenance detail when appropriate.

Do not eagerly load all source-native documents merely to render a browser list.

## Compatibility strategy

The UI migration should be incremental.

Existing browser routes, the Rules Wiki browser-facing API, the private Rules Wiki -> Rules Core Tool-to-Tool contract, authorization rules, and publication behavior are the compatibility boundaries relevant to Rules Wiki. Rules Core's public consumer API is not a Rules Wiki compatibility boundary because Rules Wiki does not use it.

During migration:

- the current generic reference browser remains usable while individual families gain specialized views;
- unknown entity types retain the generic renderer;
- specialized renderers may be introduced family by family;
- legacy `rules-core-*` CSS/DOM class names may remain temporarily where mass renaming would create regression risk;
- new UI should prefer Rules Wiki terminology, but do not perform a repository-wide class-name rename solely for cosmetic purity;
- authoring/admin views can temporarily retain older layouts while normal browsing is modernized;
- a phase must not partially move authoritative behavior into the frontend to avoid a coordinated Rules Core internal-contract change;
- a phase must not call or expand a Rules Core public API to avoid a coordinated internal-contract change;
- 5e/5.5e presentation improvements must not make 3e/3.5e records unreadable before the dedicated 3.xe phase;
- 3.xe additions must preserve the generic fallback for still-unsupported editions and entity families.

## Phased roadmap

### Phase 0 — UI foundation and compatibility normalization

Goal: establish the stable frontend foundation for the redesign without changing rules semantics.

Required work:

1. Confirm and document final hosted surface ownership: Site ribbon/footer outside; Rules Wiki owns the full-bleed body between them.
2. Remove remaining duplicate/legacy application chrome from ordinary hosted browsing.
3. Establish reusable Rules Wiki layout primitives for nav, reference browser, list, detail, tabs, disclosures, loading, empty, and error states.
4. Normalize scroll ownership so the page does not accumulate competing nested scroll containers unnecessarily.
5. Establish container-aware responsive breakpoints for wide, medium, and narrow hosted widths.
6. Preserve existing routes, internal Tool-to-Tool contracts, deep links, source visibility, and authority behavior.
7. Add or strengthen frontend integration tests for shell ownership, list/detail drill-in, route restoration, and narrow/wide behavior.
8. Treat current 5e.tools interaction patterns as reference evidence, not runtime dependencies.

Phase 0 non-goals:

- no new Rules Core semantics;
- no dedicated class renderer redesign yet;
- no broad filter-facet expansion yet;
- no adjudication workflow rewrite;
- no mass CSS class rename;
- no changes to other Tools' layouts.

### Phase 1 — reference-browser shell parity

Goal: make ordinary Rules Wiki browsing reach the interaction density and clarity of the 5e.tools list/detail model.

Required work:

- search as the dominant list control;
- compact reset/clear behavior;
- sortable family-aware columns;
- dense result rows;
- clear selected-row state;
- smooth incremental loading;
- stable list/detail proportions;
- preserved selection and scroll position where practical;
- keyboard next/previous selection and search focus;
- family/scope switching without losing recoverable context unnecessarily;
- narrow-width list -> detail drill-in;
- polished empty/loading/error states;
- remove remaining backend-workspace framing from ordinary browsing.

Acceptance requires successful use with at least monsters, spells, classes, feats, species, items, and a generic unknown family.

### Phase 2 — reusable filtering and entity-browser framework

Goal: make rich type-specific browsing data-driven rather than a sequence of one-off pages.

Introduce a Rules Wiki presentation configuration capable of defining per family:

- list columns;
- sort fields;
- filter groups;
- route family;
- row summary fields;
- renderer;
- relationship hints;
- optional specialized workspace key.

Add shared source/edition/scope filters and family-specific filters where the private Rules Core Wiki contract already exposes the needed data.

If missing facets/sort contracts are discovered, coordinate additive **internal Tool-to-Tool Rules Core APIs** rather than inferring semantics in Rules Wiki or expanding the public consumer API.

Unknown entity families must continue through generic fallback configuration.

### Phase 2.5 — accessible reference catalog and cross-edition history

Goal: make the normal browser operate on the complete source-accessible logical-reference catalog before specialized family work continues.

Required work:

- move primary Rules Wiki browse/search/detail/history away from the resolved public `/api/rules` consumer boundary and onto first-party **internal Tool-to-Tool Rules Core reference contracts**;
- Rules Wiki must not call `/api/rules`, campaign public equivalents, or any other public Rules Core consumer endpoint;
- preserve `/api/rules` and campaign equivalents strictly as effective consumer APIs used by non-Wiki game Tools;
- show one logical reference row across accessible `revision`/`rename` history while keeping variants and reprints distinct;
- support stable source-only reference identities and deep links before a Rules Layer concept or publication exists;
- allow ordinary users to inspect accessible history and read-only semantic comparison without granting Rules Lawyer or campaign-DM mutation authority;
- use an explicit published global/campaign selection when one exists, otherwise a deterministic non-persisting accessible fallback that is clearly not a ruling;
- preserve campaign inheritance/override semantics;
- support histories whose source-native category changes across editions, including prestige-class to subclass cases;
- provide both any-variation and effective-category filtering for cross-category histories;
- make Source, Package, Edition, category, campaign-override search/facets/counts server-authoritative over the complete accessible reference set;
- expose Species and Subspecies as the normal navigation taxonomy while preserving legacy race/subrace deep links and source-native types;
- prove visible/groupable/filterable 3e, 3.5e, 5e, and 5.5e history plus generic fallback for unknown imported families;
- preserve source grants as a hard boundary for rows, counts, facets, detail, history, and comparison.

Phase 2.5 non-goals:

- no Phase 3 class-family workspace redesign;
- no broad specialized renderer completion from later phases;
- no new rules engine, comparison semantics, or authorization state in Rules Wiki.

### Phase 3 — class, subclass, and prestige-class workspace

Goal: make class-family content ready for human acceptance testing, beginning with 5e and 5.5e while establishing an edition-flexible workspace.

Required work:

- dedicated class selection/search surface;
- class identity/summary;
- progression/table presentation;
- class features grouped/aligned by level;
- subclass tabs/selection;
- subclass feature alignment;
- prestige-class support without forcing it into 5e assumptions;
- source/edition version views;
- subclass/prestige-class comparison where available/useful;
- cross-edition class comparison entry point;
- stable routes for class/subclass/prestige-class selection;
- responsive behavior;
- keyboard and accessibility coverage.

All class-family semantic data required by Phase 3 must come through the private Rules Wiki -> Rules Core Tool-to-Tool API. Phase 3 must not consume or expand Rules Core's public consumer API for class relationships, progression metadata, feature acquisition levels, comparison, source history, or any other Wiki requirement.

The workspace should be structurally capable of showing 3e/3.5e class-family data even though 5e/5.5e is the first human-testing target.

### Phase 4 — 5e/5.5e player-reference completion

Goal: make the primary 5e/5.5e player-facing rules families consistently usable for human testing.

Bring these families to the new reference-browser standard:

- species/races;
- backgrounds;
- feats;
- options/features;
- skills/competencies;
- spells;
- items;
- conditions and other directly referenced rule records.

Each family receives:

- useful columns;
- useful filters;
- specialized presentation where generic structure is insufficient;
- source/edition tabs;
- cross-links/relationships where Rules Core exposes them through the internal Wiki contract;
- stable routes and responsive behavior.

Do not mark this phase complete merely because records render. Human testers must be able to find, distinguish, and inspect records efficiently.

### Phase 5 — 3.xe (3e/3.5e) reference completion

Goal: deliberately stress the new UI architecture against D&D 3e and 3.5e before bestiary completion, proving that the system is edition-flexible rather than a 5e UI with extra labels.

Required work:

- use the Phase 3 class workspace for 3e/3.5e base classes and prestige classes;
- render BAB, Fortitude/Reflex/Will progressions, skill points/class skills, caster progression, prerequisites, and other class-table fields without flattening them into 5e concepts;
- support 3e/3.5e race/species presentation without assuming 5e species fields;
- present ranked skills and family skills such as Craft, Knowledge, Perform, and Profession clearly;
- support class/cross-class or other edition-specific competency context when Rules Core exposes it;
- present feat categories, prerequisite chains, and related-feat relationships;
- present 3.xe spell metadata including class-dependent spell levels, school/subschool/descriptors, components, range, duration, saving throw, spell resistance, and material/XP/focus costs where available;
- present 3.xe item mechanics such as weapon/armor categories, enhancement/special properties, charges, costs, and related rules;
- provide usable browsing for combat/reference mechanics such as touch AC, flat-footed AC, BAB, grapple, DR, SR, and miss chance where represented as rules content;
- expose clear 3e versus 3.5e source/version identity;
- verify semantic comparison entry points for 3e -> 3.5e differences;
- add family-specific columns and filters needed for efficient 3.xe lookup;
- retain generic fallback for 3.xe fields that do not yet have a specialized visual component.

Acceptance should include at least:

- a 3.5e base class;
- a prestige class with meaningful prerequisites;
- a ranked/family skill example;
- a prerequisite-heavy feat;
- a spell whose metadata differs materially from the 5e presentation model;
- an item with 3.xe-specific mechanics;
- one 3e versus 3.5e concept comparison.

This phase does not complete the 3.xe bestiary. Monster-specific 3.xe presentation is handled in Phase 6 so bestiary behavior can be evaluated as one cross-edition stat-block system.

### Phase 6 — bestiary and stat-block completion

Goal: complete the bestiary around the existing D&D 5.5e-inspired stat-block foundation while preserving edition-specific mechanics.

Required work:

- richer bestiary list columns and filters;
- fast monster search;
- complete normalized stat-block field coverage;
- robust fallback for source-edition-specific mechanics;
- 5.5e-style ability score/modifier presentation;
- 3e/3.5e support for touch/flat-footed AC, BAB, grapple, saves, DR, SR, miss chance, and other applicable fields;
- actions/bonus actions/reactions/legendary/mythic/lair/regional sections where applicable;
- edition-appropriate action/attack structures without inventing absent mechanics;
- source/edition tabs;
- edition comparison in stat-block context where practical;
- links to related creatures/mechanics when Rules Core exposes them through the internal Wiki contract;
- print/focused reading behavior if useful at the table.

### Phase 7 — global search and reference conveniences

Goal: reduce the time from "I need a rule" to "I am looking at it."

Candidate capabilities:

- omniselect/omnisearch across accessible Rules Core-backed content through the internal Wiki contract;
- keyboard-first result navigation;
- direct jump to exact record;
- recently viewed records;
- temporary pinned/reference list;
- focused popout/read mode where it benefits table use;
- copy/link/share conveniences.

Do not reproduce unrelated 5e.tools utilities merely for parity.

### Phase 8 — source and edition context redesign

Goal: make provenance and edition alternatives understandable without overwhelming ordinary browsing.

Required work:

- compact edition/source tabs;
- clear effective-rule identity;
- source provenance as progressive disclosure;
- source-package/access context where relevant;
- source-version labels that avoid ambiguity;
- readable treatment of equivalent representations;
- clear separation of effective Dorks & Dice/campaign result from source evidence;
- source-library transitions that retain useful context.

### Phase 9 — cross-edition comparison UX

Goal: make edition comparison a polished first-class Rules Wiki capability.

Required work:

- compare tab integrated into normal detail;
- sensible default pair selection;
- edition/source selectors;
- clear semantic categories for differences;
- unchanged content minimized;
- entity-aware comparison for high-value families;
- specific validation of 3e -> 3.5e and 5e -> 5.5e comparisons;
- direct links back to each complete source version;
- compact provenance on compared values;
- read-only comparison for normal users;
- authorized resolve-this-difference transition.

Rules Core remains authoritative for comparison semantics and automatic compatibility, supplied to Rules Wiki through the internal Tool-to-Tool API.

### Phase 10 — adjudication and campaign-resolution redesign

Goal: transform Rules Lawyer/campaign authoring from inherited backend workspace UI into an in-context human ruling workflow.

Required work:

- enter with concept/context already selected when launched from browsing;
- show current published effective result first;
- show relevant source/edition evidence second;
- show semantic differences before raw documents;
- make decision scope explicit but not redundant;
- separate draft/save from publish;
- preserve append-only decision semantics;
- distinguish global ruling from campaign override;
- clearly show inherited campaign baseline;
- keep manual concept creation and normalization as secondary/escape-hatch tools;
- preserve source-access and authority constraints.

### Phase 11 — Sources and maintenance modernization

Goal: bring source-management surfaces into the same visual system without allowing maintenance UI to dominate the product.

Modernize:

- Source Library;
- source inspection;
- import/add-source workflow;
- revision/update review;
- normalization queues;
- hosted-source maintenance;
- source-access/acquisition administration.

Large maintenance operations should expose progress, errors, and resumable/recoverable states clearly. Source credit/attribution must remain visible where required.

### Phase 12 — reading/reference modes and long-form content

Goal: support long-form rules and book-like reference content without forcing it into a dense two-column browser when that is not the best reading model.

Candidate work:

- readable-width article mode;
- sticky outline/table of contents;
- heading deep links;
- quick-reference layout;
- print-friendly output;
- focused reading mode;
- return-to-browser context preservation.

### Phase 13 — accessibility, responsive, and performance hardening

Goal: treat the redesigned surface as production-ready across real devices and input methods.

Required validation includes:

- keyboard-only navigation;
- screen-reader semantics for nav/list/tabs/disclosures;
- visible focus;
- reduced motion;
- zoom/reflow;
- narrow mobile widths;
- tablet/intermediate embedded widths;
- wide desktop widths;
- host light/dark appearance;
- large catalogs;
- slow Rules Core responses;
- stale-request cancellation;
- route refresh/back/forward;
- authenticated capability variation;
- source-access variation;
- campaign membership/role variation.

### Phase 14 — human acceptance and UI consistency pass

Goal: test complete user tasks rather than individual components.

Run acceptance scenarios for at least:

- player looking up a 5e/5.5e spell during play;
- player comparing 5e and 5.5e versions of a feature;
- player browsing a 5e/5.5e class and subclass;
- player browsing a 3.5e base class and prestige class;
- player locating a 3.xe skill, feat, spell, and item by edition-relevant filters;
- user comparing a meaningful 3e and 3.5e rule difference;
- DM finding a monster and reading its complete stat block;
- DM inspecting a 3.xe monster without losing edition-specific statistics;
- DM browsing campaign-effective rules;
- Rules Lawyer comparing conflicting editions and recording a draft ruling;
- campaign DM creating an override without affecting global rules;
- user inspecting source provenance;
- authorized maintainer adding/updating a source;
- mobile/narrow user navigating list -> detail -> back without losing context;
- user following a shared deep link directly to a rule.

Fix terminology, spacing, density, hierarchy, inconsistent controls, and unnecessary backend exposure discovered through these scenarios.

## Phase branch strategy

Each implementation phase should use a focused branch from current `main`, for example:

```text
feature/ui-phase-0-foundation
feature/ui-phase-1-reference-browser
feature/ui-phase-2-filter-framework
feature/ui-phase-3-class-workspace
feature/ui-phase-4-5e-reference
feature/ui-phase-5-3xe-reference
feature/ui-phase-6-bestiary
```

Do not modify `main` directly and do not merge until explicitly authorized.

When a phase discovers a required Rules Core semantic/API addition, use a separate Rules Core branch and change the **private Rules Wiki Tool-to-Tool contract**. Keep cross-repository dependency explicit in PR descriptions and validation rather than mixing backend semantics into Rules Wiki. Do not expand or consume the Rules Core public API for a Rules Wiki phase.

## Before each implementation phase

1. Fetch current Rules Wiki `main`.
2. Read this development plan in full, especially the hard invariants and current phase.
3. Read `docs/architecture.md`, especially the non-negotiable Rules Core API boundary.
4. Inspect the current implementation instead of assuming the plan reflects every detail of the latest repository.
5. Inspect any active overlapping Rules Wiki UI branch/PR.
6. Inspect the current **internal Rules Wiki -> Rules Core Tool-to-Tool contracts** used by the phase.
7. Confirm that the current Wiki implementation does not depend on a Rules Core public/external endpoint for the phase's workflow.
8. Create or update the focused phase branch from current `main`.
9. Preserve unrelated changes already merged to `main`.
10. Identify whether the phase needs any coordinated Rules Core internal-contract change before writing frontend workarounds.
11. If a needed capability exists only on the public Rules Core API, do not call that endpoint from Rules Wiki; expose/reuse the underlying Rules Core semantics through the internal first-party contract instead.
12. Keep other Dorks & Dice Tools and Site layout behavior unchanged unless the phase explicitly calls for a separately reviewed opt-in host capability.

## Validation strategy

Every phase should include the narrowest useful combination of:

- unit tests for presentation helpers and route/state parsing;
- asset/integration tests for exported UI contracts;
- browser-level tests for real interaction paths when practical;
- responsive tests based on embedded container width;
- accessibility assertions for role/name/state;
- route/deep-link/back-forward tests;
- stale async result protection tests;
- capability/authorization presentation tests;
- regression tests ensuring generic unknown families remain browsable;
- regression tests ensuring source restrictions are not bypassed by presentation changes;
- regression tests ensuring Rules Wiki uses only the private Rules Core Tool-to-Tool API and does not regress onto public consumer endpoints;
- edition-shape regression tests where a specialized renderer supports more than one edition family.

Where human visual judgment matters, automated tests should protect structure and behavior while human acceptance evaluates density, clarity, and usability.

## Phase 0 required validation

Phase 0 should prove at least:

- hosted Rules Wiki uses the full application body without changing another Tool's layout;
- the Site ribbon and footer remain Site-owned;
- no duplicate Rules Wiki title/application chrome appears in hosted mode;
- the Rules Wiki nav remains attached to the application surface;
- ordinary browsing preserves existing stable routes;
- a direct deep link loads the correct record;
- back/forward navigation restores the correct family and selection;
- narrow width uses list/detail drill-in rather than an unusable stacked desktop workspace;
- generic unknown entity families still render;
- no new Rules Core semantic logic has been introduced in Rules Wiki;
- Rules Wiki does not call Rules Core's public consumer API.

## UI architecture definition of done

The target architecture is reached when a user can:

1. enter Rules Wiki beneath the normal Dorks & Dice ribbon without encountering duplicate application chrome;
2. navigate directly by familiar content family rather than backend subsystem;
3. search, sort, and filter large rules catalogs with speed comparable to a mature reference site;
4. select a result and inspect it without losing browsing context;
5. follow or share a stable deep link to the same concept;
6. browse 5e/5.5e classes and subclasses through a purpose-built class workspace;
7. browse 3e/3.5e base classes and prestige classes without losing edition-specific progression or prerequisite information;
8. find and read 3.xe skills, feats, spells, items, and combat/reference mechanics without forcing them into 5e semantics;
9. read monsters in the D&D 5.5e-style presentation while retaining edition-specific mechanics such as 3.xe touch AC, BAB, grapple, DR, and SR when applicable;
10. inspect the effective Dorks & Dice or campaign rule as the primary result;
11. inspect accessible source/edition versions without confusing them for the effective ruling;
12. compare two editions/source versions through semantic differences supplied by Rules Core, including meaningful 3e -> 3.5e and 5e -> 5.5e cases;
13. move from a conflict directly into the correct global or campaign ruling workflow when authorized;
14. save a draft ruling without accidentally publishing it;
15. understand campaign inheritance versus campaign override;
16. inspect provenance/source evidence without maintenance UI dominating ordinary browsing;
17. use the same core workflows on wide desktop, intermediate embedded widths, and narrow/mobile layouts;
18. complete ordinary browsing with keyboard-only input and visible accessible state;
19. continue browsing unknown/imported entity families through generic fallback even before specialized UI exists;
20. use Rules Wiki with no runtime dependency on 5e.tools;
21. use Rules Wiki without any duplicate rules semantics or authorization state being owned outside Rules Core;
22. evolve Rules Wiki UI independently without forcing layout changes onto other Dorks & Dice Tools;
23. use Rules Wiki without any dependency on Rules Core's public/external consumer API; all Rules Wiki -> Rules Core traffic remains on the private delegated Tool-to-Tool contract.
