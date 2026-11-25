# Workstream C — generalized creature presentation (initial candidate)

Foundation: 4c15cac665e96cf9cea4a3ddd046e0c739e399d7; Core source: 6a300933435c633b51f1d446fca09b9810dceb9e. The audit enumerated 331 SRD 5.1 and 350 SRD 5.2.1 native records. The first-party Goblin Warrior and Tarrasque use the outer metadata/definition wrapper; imported monsters are flat records. The existing first-party monster compatibility route and imported registry adapter share native-monster-detail.js. The foundation's package notice remains dispatcher-owned.

| Capability | First-party | SRD 5.1 | SRD 5.2.1 |
| --- | --- | --- | --- |
| Classification, scores, AC, HP, speed | Existing statblock and aliases | Flat, conditional AC/speed, symbolic HP | Flat, conditional and symbolic AC/HP |
| Saves and initiative | Existing ability and historical saves | Sparse authored saves; no initiative field observed | Sparse or explicit saves; numeric modifier/score or proficiency descriptors |
| Damage and conditions | Existing first-party rendering | Lists and conditional grouped defenses | Lists and conditional grouped defenses |
| Challenge/XP | Existing CR and XP | CR or challenge rating/XP | CR or challenge; lair XP and legendary actions |
| Traits, actions, spellcasting | Existing including complex combatant | Spell slots and frequencies | Spellcasting by action/bonus/reaction, daily shared uses |
| Variants and summons | Existing metadata, complex layout | Variant IDs, barding | Variant selections, summoning spell level, symbolic values |
| References | Existing first-party behavior | Explicit local catalog IDs | Explicit local catalog IDs |
| Complex combatant | Existing Kaiju presentation; synthetic fixture only | Not required | Not required |

Presentation intentionally does not manufacture absent XP, resolve initiative proficiency into a modifier, replace symbolic summons with calculated values, or infer missing imported saves. The existing shared generic fallback handles unfamiliar objects and the existing creature inline parser remains the interim path for known inline tags. Workstream B must replace that compatibility path with its finalized structured content renderer, preserving dice actions and explicit scoped reference semantics. No new tag parser is added. Explicit catalog references are available as qualified links, not inferred from source tags; embedded links remain pending B. Source layout text is a separate disclosure. Source attribution remains separate from package attribution.

## Representative visual acceptance cases

Use the pinned actual record fixtures in `tools/fixtures/multi-system/creature-workstream-c.json`, plus the foundation first-party Goblin Warrior and Tarrasque and synthetic Kaiju fixtures. Review standard desktop and narrow detail panel: both Werewolves (conditional AC/movement vs revised statblock), both Avatars of Death (symbolic HP and zero XP, explicit initiative in 5.5e), Acolyte and Priest Acolyte (spell slots and bonus-action spellcasting), both Adult Red Dragons (legendary/lair differences), Animated Object and Draconic Spirit (symbolic values and variants), first-party Tarrasque and synthetic Kaiju (two-column layout and responsive stacking). Actual authored multipart combatant is not available in pinned Core. No screenshot/browser acceptance or exhaustive SRD source-fidelity audit is claimed.

## Remaining integration

B's finalized structured-content contract and scoped inline links, browser acceptance at desktop/mobile widths, runtime private foreign access under approved test-only policy, and confirmation of regression CI are required before acceptance. No policy, deployment, dispatcher, global CSS or shared fixture manifest changes.

Self-review added swarm classification, source movement choices, slot labels, nonnumeric ability values, and actual first-party fixture coverage. The missing-save dash denotes an unsupplied field, not a claim that a saving throw is unavailable. Existing first-party inference behavior remains unchanged.

## Local visual fixture preview

From repository root, run `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/tools/visual/creature-preview.html`. Select any imported fixture, actual first-party Goblin Warrior or Tarrasque, or the separately labeled synthetic Kaiju, at full width, 1024, 760, 420 and 320 pixels. This uses the actual renderer and production creature stylesheet with a minimal offline theme; it is not a substitute for integrated host/theme acceptance. Check conditional stat wrapping, spell slots/actions, symbolic values, and Kaiju stacking. The preview makes no Core requests. No browser screenshot acceptance has been performed from this environment.

Additional shape review includes SRD 5.1 Green Hag coven CR and SRD 5.2.1 Otherworldly Steed selectable type; both are pinned fixtures and tested. Approved first-party design data does not itself establish a concrete resistance map field in authored creatures; no speculative field name or runtime mechanic is introduced.

## B integration handoff

B's initial shared module exports `renderInlineContent`, `renderStructuredReference`, and `renderStructuredContent(value, { input, renderDice, inlineClass, referenceIds })`. Please re-export the inline and reference functions from `native-presentation.js` alongside `renderStructuredContent` (B owns that file). C's adapter automatically selects the shared content hook once the named inline export exists; until then it retains the pre-existing creature parser and bounded dice actions. The hook passes the exact presentation input and exported creature-specific dice callback. No tag-to-ID mapping is invented: native catalogReferences provide explicit scoped links, but inline tags lack explicit token-to-ID mappings in the audited source records. B subsequently added resolveSourceReferenceIds(input); C consumes it when re-exported and a bound reader supplies resolve. Its exact same-catalog ID/name/release checks provide the referenceIds map without speculative tag-derived IDs. The adapter suppresses links without a matching snapshot reader. The first-party legacy renderer remains unchanged until B and integration owner coordinate its context-aware transition. C does not copy or modify B-owned modules.

The asynchronous bridge passes the prepared map into the shared renderer and returns detached DOM through the existing lifecycle-aware dispatcher. A resolver probe is covered on the foundation; real integration assertions activate when B's three public exports are present. Pinned Bless and Frightened records from each edition and the SRD 5.2.1 Tarrasque provide actual source-backed reference tests. No foreign catalog transport or authorization changes are introduced.

Conditional AC and entry titles preserve inline tokens through the B content hook; the pinned Archmage and Mage Armor fixtures verify the reference in the stat tile rather than only the catalog list. The foundation fallback still renders the same conditional AC as readable text.
