# Workstream E — native entity presentation and coverage

Base: 4c15cac665e96cf9cea4a3ddd046e0c739e399d7. Core fixture revision: 6a300933435c633b51f1d446fca09b9810dceb9e. Integration target: feature/wiki-multi-system-integration.

## Implementation and ownership

The reference registration slot now selects structural adapters for spells, imported equipment, native equipment qualifications, imported origins, native origins, first-party Origin rules, imported conditions, skills/competencies, feats, tables, Fate structured rules, and general textual records. The shared registry and dispatcher remain unchanged. The first-party condition/leveled-condition path is deliberately not overridden; it continues to use condition-detail.js and its established effect/recovery rendering. Creature and class presentation remain with C/D.

The recovered historical renderStructuredRule frame is used for all new adapters. Its default resolved-rule path, existing extensions, disclosures, and historical category functions remain intact. Native callers supply a structured content callback; the shared frame continues to own summary statistics and section layout. Existing formatting functions are reused for spell, item, size, speed, armor, and feat summaries. Known D&D ability and item property labels are display normalization only. No formula, choice, qualification, template inheritance, skill rank, or origin inheritance is executed.

Workstream B's documented renderStructuredContent(value, { input }) contract is the only rich content entry point. Fate Markdown is passed as { markdown }, and nested entries/tables/choices remain native values. The integrated adapter uses B's rich renderer for those native values; the pre-B fallback is no longer an acceptable test outcome. E does not implement a separate Markdown or source-tag parser. Exact catalog references and known explicit reference fields are linked with input.hrefForRule only with a bound reader. Foreign-scoped nested references are not converted into local links. Display-name/5etools-tag inference is prohibited; optional inline mapping through B's exact resolver is not used. Entity attribution uses renderNativeAttribution; package attribution is left to the dispatcher.

The original record is never mutated. Important authored fields are visible, other source fields remain readable in sections or a collapsed disclosure, and exact spell publisher layout is retained separately. Rulebook page text is rendered as selectable plain text. Source review status remains in attribution. Numeric summaries do not substitute for source data.

## Native category inventory and coverage matrix

The repository tree and native records at the pinned Core revision were inspected across the four rulesets, including aggregate category files, spell/monster/class/item shards, item groups/templates/variants, publisher-recovered records, and first-party Origin directories. The following is an observed category inventory, not a claim that every record or every shard was fetched. The source counts below are exact for the named files only. Use the accompanying read-only Git inventory script for exhaustive category counts from an available Core checkout.

| Family / actual observed kinds | Dorks & Dice | D&D 5e | D&D 5.5e | Fate Condensed | E presentation |
| --- | --- | --- | --- | --- | --- |
| spell | No standalone spell files identified; spell-access rule remains legacy | spell | spell | — | Spell header and structured rules; first-party spell adapter only if compatible fields exist |
| item / baseitem | — | item, baseitem | item, baseitem | — | Shared equipment frame; weight, value, armor, damage, properties, attunement, mastery |
| item-group / magic-variant | — | item-group, magic-variant | item-group, magic-variant | — | Group/template explicitly identified; no concrete stat inheritance; named/numbered variants remain item records |
| item-property / item-mastery | — | item-property | item-property, item-mastery | — | Shared equipment or generic structural view |
| equipment-group / equipment-type | equipment-group, equipment-type | — | — | — | Qualification identities only, not playable inventory |
| Origins | species, ancestry, origin-trait, upbringing, background | race, subrace, background | species, background | — | Separate native and imported structural adapters; source identity and terminology retained |
| Construct origination | construct-component, construct-design, construct-material, construct-enhancement, construct-power-source, crafting-material, crafting-recipe | — | — | — | Native Origin frame; candidate/provisional data remains visibly identified; no construction |
| condition | condition, leveled-condition | condition | condition | — | Preserve native condition view; imported text/levels/tables; no cross-edition equivalence |
| skill / skill-family | skill, skill-family | skill | skill | skill | System-aware summaries; native parent/child/family and composition relationships; Fate rating only |
| competency | competency, competency-category | — | — | — | Profile, associated tools, authored category members; no proficiency grants |
| feat / optional-feature | Class/feature records handled by D | feat, optional-feature | feat, optional-feature | — | Feat prerequisites/choices; optional-feature textual fallback has lower priority than D |
| Actions and options | General rule records | action, activity, equipment-option, combat-option, attack-option, reaction-option | action, activity, equipment-option, combat-option, reaction-option | action | Text/time/reactive fields, explicit reference links; no action execution |
| General rules | rule, harvesting-procedure | rule | rule | rule | First-party Origin rule structure specialized; other first-party legacy retained; imported and Fate structured rules or text |
| Language, sense, glossary, status | language | language, sense, status | language, sense, glossary, status | — | Imported textual/field view where compatible; otherwise generic or legacy |
| Hazards and diseases | — | trap, disease | trap, hazard, environmental-effect, magical-contagion | — | Textual entries and authored extra fields |
| Deities | — | deity | — | — | Generic if no textual structure, no invented deity taxonomy |
| Tables / pages / chapters | Native rule tables remain legacy | table, rulebook-page | table, rulebook-page | chapter, rule (nested sections) | Shared table renderer, publisher page layout, Markdown with parent reference |
| Creature/class | monster, creatureType, monsterFamily; class, classFeature, invocation, pact, patron | monster; class, subclass, class-feature, subclass-feature | monster; class, subclass, class-feature, subclass-feature | — | C/D ownership; no new renderer or dispatch change |

Verified examples of source counts: Fate sections.json contains 11 chapter and 116 rule records; structured.json contains 19 skills, 4 actions, 3 structured rules (153 total across the only two native JSON files). First-party skills.json has 79 skills and 2 skill-family records; competencies.json has 26 competencies and 1 category; conditions.json has 29 conditions and 1 leveled-condition; equipment-qualifications.json has 29 groups and 35 types. D&D conditions.json contains 15 conditions in each edition. D&D 5e character-origins.json contains 9 races, 4 subraces, 1 background; D&D 5.5e contains 9 species and 4 backgrounds. D&D 5e general-rules.json has 10 actions, 18 languages and 4 senses; 5.5e has 12 actions, 19 languages and 4 senses. Both D&D item catalogs distinguish template records from derived items, including armor-resistance shards.

The first-party biological files use ancestry and origin-trait IDs rather than importing a D&D race model. Origination methods and inheritance rules are actual first-party rule records. Heritage and Manifestations remain conceptually distinct; no standalone record category is fabricated for a concept not represented as its own native entity at this revision.

Exhaustive authored inventory command:

    node tools/audit-native-entity-catalog.mjs /path/to/dorks-and-dice-rules-core

The script reads the pinned Git commit (not working-tree changes), mirrors loader record boundaries and Construct path identity projection, excludes metadata, and reports per-kind counts and example IDs. It is not a substitute for the C# loader. A local Core checkout was unavailable in the assistant environment, so the full-tree script has not been executed there.

## Reusable renderer inventory

| Historical function | Disposition |
| --- | --- |
| renderStructuredRule / renderStructuredDetails / renderStructuredTextSection | Shared frame extended with an optional native structured-content callback and heading; legacy defaults preserved |
| renderSpell and formatSpell* / formatCastingTime / hasConcentration | Native spell adapter reuses the established frame and formatters; prefer edition-specific authored header |
| renderItem and formatItem* / formatRarity / formatWeight / formatCurrency / formatAttunement | Reuse helpers, add explicit group/template/derived distinction and mastery/property labels |
| renderSpecies | Reuse frame, size and movement formatters; native Origins remain separate from imported ancestry |
| renderFeat | Reuse frame/category formatter; prerequisites and choices remain structured |
| renderSkill | Reuse frame; display full ability labels only where present; native skill-family and competency fields preserved |
| renderCondition | Imported condition adapter uses shared entries and actual level count |
| renderConditionDefinition | Unchanged first-party semantic renderer |
| renderGeneralRule | Shared structured frame for general textual records, no per-kind renderer proliferation |
| renderMonster / renderClass / renderSubclass / renderPrestigeClass | Unchanged, C/D scope |

## Test cases and visual review

The E-specific manifest under tools/fixtures/native-entities pins additional authored records with exact Core file, revision and identity. The foundation manifest remains unchanged. Existing foundation fixtures and E fixtures together cover the four rulesets. Synthetic edge cases are defined separately in the test file, not represented as native content.

Run:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run test:reference-entities
    npm run test:reference-entities -- --preview-dir /tmp/wiki-entity-previews

The integrated test always requires B's actual Markdown/table/tag rendering and D's ownership of class-specific options. The preview option generates standalone DOM fixture pages using repository stylesheets; it is a review aid, not a hosted browser acceptance result. Review desktop and narrow mobile layouts for the following cases:

| Case | Reading focus |
| --- | --- |
| Acid Splash 5.1 vs 5.2.1 | Same ID, differing school and casting terminology; publisher disclosure and local source page |
| Backpack, Plate Armor, Javelin of Lightning | Value/weight/AC/damage/property/mastery summaries and source links |
| Arcane Focus group, +1 Ammunition template, +1 Arrow, Adamantine Breastplate | Non-concrete source definitions vs concrete derived items |
| Human and Acolyte in first-party and 5.5e; Drow ancestry; Skillful trait; Origin rules | No collapse of first-party Origination/Heritage/Manifestations/Upbringing into imported species |
| Exhaustion in all three D&D-related catalogs | First-party semantic condition UI remains; imported 5.1 and 5.2.1 differ |
| Athletics in D&D, first-party and Fate; Perform family; Smithing | Distinct ability/rating, family/composite relationships and competency profile |
| Fate Taking Action, nested Adjective Ladder, Attack, Stress Capacity, Starting Skill Pyramid | Markdown hierarchy, actual nested table, rating/track allocation |
| Character Advancement table; trap, glossary, language, sense, rulebook page | Generic structured reading and discovery |

## Remaining work and integration conditions

- B #44 and A #43 are integrated before E #45; the combined registry also contains C and D. Full hosted visual and browser acceptance of the integrated A–G candidate remains required. No private foreign access change is requested.
- The integrated npm test entry retains all workstream commands and requires the actual shared structured renderer.
- Exact explicit source IDs are linked when a reader is bound. Inline tags remain readable; optional exact-token matching via B's authorized resolver can be a bounded follow-up if useful. No link inferred from names.
- Reverse membership for skill families and document child sections is not computed from display names or by crawling the entire catalog. Authored forward references and parent links remain available; a bounded navigation/query enhancement belongs with A/Core if needed.
- First-party concrete spell/item records and standalone Heritage/Manifestation entity families were not identified at the pinned revision. No fabricated mechanics or fixtures were introduced. Actual loader-expanded origin projections, additional unknown imported shards, and complex construct recipes merit integrated visual review.
- The first-party legacy condition renderer, class/creature ownership, authorization, campaign rules, source imports and deployment remain unchanged. No main merge or deployment is authorized.
