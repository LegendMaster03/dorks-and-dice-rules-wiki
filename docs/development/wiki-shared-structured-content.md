# Workstream B — shared structured-content rendering

Baseline: 4c15cac665e96cf9cea4a3ddd046e0c739e399d7. Core fixture revision: 6a300933435c633b51f1d446fca09b9810dceb9e. No changes to catalog access, distribution, gameplay resolution, campaign functionality, renderer registration, or deployment.

## Interface for C, D, E

Import renderStructuredContent(value, options) from native-presentation.js (the foundation entry point) or structured-content.js. The latter also exports renderInlineContent, renderMarkdown, renderStructuredReference, stripSourceTags, rendererTagText, and resolveSourceReferenceIds. All render methods return detached DOM nodes synchronously. Options are trusted presentation configuration; never populate options from a native document.

    import { renderStructuredContent } from "./native-presentation.js";
    import { renderInlineContent, resolveSourceReferenceIds } from "./structured-content.js";

    // Synchronous content: source labels and exact Core references.
    const section = renderStructuredContent(input.record.entries, { input });

    // Optional inline link preparation within the same authorized reader.
    const referenceIds = await resolveSourceReferenceIds(input, input.record);
    if (!input.lifecycle?.isCurrent()) return;
    const body = renderStructuredContent(input.record.entries, { input, referenceIds });
    // Return a detached node; registry mounts only the current lease.

    // Statblock-specific roll controls remain owned by C.
    const inline = renderInlineContent(text, {
        input, referenceIds, inlineClass: "rw-stat-inline",
        renderDice: ({ tag, expression, display }) => {
            // Return a safe DOM control only for a supported, bounded roll.
            // Return null to preserve display-only content.
            return createValidatedRollButton(tag, expression, display);
        }
    });

Exact catalogReferences and structured ruleId references produce qualified paths only when a matching bound reader is present. Explicitly foreign-scoped objects (including nested descendants, wrapped table rows, and definition wrappers) can not borrow local reference authority; foreign-only tags do not initiate local reads. Source tags are not native IDs. Optional preparation resolves only Core-listed native IDs using that reader, matching exact normalized name, kind and source release, without name-based searches or deriving slugs. Unknown release, ambiguous target, denied/missing record, or stale lease yields plain text. No links for class feature tags with insufficient identity, filter queries, or page-style quickrefs without authoritative mapping. Caller-provided referenceIds must contain only authoritative exact token-to-ID mappings. No new transport or access policy. No persistent caches. To bound optional preparation, >64 relevant candidates remain plain text. The synchronous generic fallback displays explicit reference links separately; it does not initiate resolution requests.

## Supported content

| Content | Presentation |
| --- | --- |
| Strings, numbers, booleans, null | Inert text, with source tag rendering for strings |
| Arrays | Paragraph/block sequence; sequence: "list" for callers requiring a value list |
| entries, section, inset, item, options, header/attack/hit/footer entries | Named hierarchy, all body fields, extra mechanics retained |
| list, ordered / list-ordered / decimal style | Semantic ul/ol, named children retained |
| table, caption, colLabels, rows, wrapped row | Semantic table and headers; styles and source metadata disclosed, not applied as arbitrary classes |
| choices, prerequisites, unknown objects | Labeled fields; no gameplay interpretation |
| b/bold, i/italic, u, s/strike, sup/sub, code | Safe nested inline elements |
| dice, damage, hit, d20, chance, scaledice/scaledamage, recharge | Authored display or readable expression; no rolling unless adapter supplies validated control |
| atk, atkr, h, dc, actSave, actSaveFail/Success and combined outcomes | Display labels; no mechanical execution |
| spell/item/condition/creature/class/feat/race/species/background/action/skill/language/sense/status/variantrule, itemProperty/itemMastery, hazard/disease/trap | Authored display label; optional exact resolved link |
| classFeature/subclassFeature, quickref, book, filter | Display text; no guessed target or filter execution |
| Unknown/malformed source tags | Readable payload or literal malformed token |
| Fate Markdown | Headings, paragraphs, nested ordered/unordered lists, pipe tables, links, bold/italic, inline code, blockquotes |
| Fate export markup | Attribute-free table/tbody/tr/td grammar, empty named anchors mapped to prefixed spans, dice symbols as text spans |
| Arbitrary HTML / malformed table | Literal text, no parsing as source HTML |
| Source / technical fields | Collapsed disclosure; attribution stays with existing foundation components |

Markdown supports the observed Fate subset, not a general CommonMark implementation. Absolute HTTP(S) links and safe local fragments only; relative/unverified links remain readable. No embedded media, HTML, arbitrary CSS or event attributes. Heading offset defaults to 2; set headingOffset explicitly to preserve reading hierarchy in an adapter. The table grammar is intentionally narrow. Unknown field names remain readable; technical data is retained in disclosure. Deeply nested content is bounded at 80 levels; inline nesting at 24.

## Evidence

Inspected the foundation fixture records for first-party Goblin Warrior, D&D 5e Warlock, Avatar of Death, Character Advancement, D&D 5.5e Acid Splash, and Fate Taking Action and Adjective Ladder. Actual pinned Core samples: both spells-001-025.json, both book-rules-and-tables.json, both bestiary/structured-01.json, D&D 5.5e character-origins.json and classes/warlock.json, D&D 5e items/structured-01.json, Fate sections.json. These demonstrate nested entries, list/item/inset, row wrappers, formatting, display overrides, source releases, dice and attack tags, explicit catalogReferences, and Fate's exported tables, anchors and dice elements. This is a representative inspection, not an exhaustive audit of every D&D shard. Unsupported tags remain inert and readable. No external proprietary material fetched.

## Historical migration plan and integrated outcome

C, D and E now consume the shared entry points; C's independent creature inline/recursive parser was removed, and the integrated test suite requires the shared content and class option adapters. The remaining legacy first-party resolved-rule paths and explicit specialized layouts are preserved. The list below records original ownership and migration decisions, not outstanding work.

- native-presentation.js now delegates its generic fallback to the common module, retaining exactly-once attribution and registry behavior.
- rule-renderer-support.js delegates renderNamedRuleEntry, renderRuleContent, appendRuleContent, renderRuleTable, stripRendererTags and formatRendererTag. Existing legacy caller signatures remain valid. Specialized layouts remain untouched.
- C owns native-monster-detail.js: replace inlineContent/tagText/renderContent with shared inline and structured primitives while retaining validated rollExpression, roll announcement, statblock CSS, availability labels and complex combatant presentation. Preserve specialized spellcasting layout.
- D owns native-class-option-detail.js ruleParagraphs and class value callbacks: migrate prose and nested entries; preserve progression, class feature disclosure, state and navigation.
- E owns condition/detail and specialized entity modules: retain semantic condition effect descriptions and specialized layouts; delegate prose, entries and tables.
- Foundation/integration owns native-rule-detail.js renderNativeValue. Keep its first-party compatibility behavior until the owner coordinates replacing the remaining recursive raw rendering with the shared primitives. Do not modify dispatcher, registration slots or app.js in B.
- Legacy formatAttackTag remains a compatibility helper for its existing callers; consolidate only when callers are migrated. Source and package attribution components remain unchanged.

## Tests

Run npm test (includes tools/test-structured-content.mjs) or node tools/test-structured-content.mjs after installing the repository's pinned dependencies. Uses existing manifest-pinned fixtures across all four systems and synthetic edge cases for nested entries, row wrappers, mixed markup, source-scoped links, stale/denied references, Markdown, unknown entries and injection. Fixture fingerprints are synthetic. Full regression and browser acceptance are required before integration. The local assistant environment lacks GitHub DNS access and jsdom, so remote CI is the executable validation path; no local full-suite result is claimed.
