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
