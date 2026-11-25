# Workstream D — Generalized class presentation

## Source and scope

Foundation: `4c15cac665e96cf9cea4a3ddd046e0c739e399d7` (combined validation runs 45689732372 and 45689519451). Core fixture revision: `6a300933435c633b51f1d446fca09b9810dceb9e`. The fixture manifest records the exact native class and option files; the existing foundation fixture supplies the actual first-party Warlock and Fate records. These are source records, not claims about runtime authorization or production fingerprints. Existing first-party class/option tests remain the preservation baseline.

The historical class/subclass/prestige-class renderers in `rule-renderers-specialized.js` supply the earlier identity, equipment, prerequisite and feature surfaces. The existing `class-family-model.js` already normalizes identity fields and published table groups; reuse those helpers rather than bringing the variation editor or a second layout into the native reader. The native class renderer owns the class advancement/feature cards, section navigation and reading return state. The imported structural adapter feeds the existing renderer a read-only projection. The resolved-rule variation and authoring pipelines are unchanged.

## Compatibility and presentation matrix

| Capability | Dorks & Dice Warlock | SRD 5.1 Warlock | SRD 5.2.1 Warlock |
| --- | --- | --- | --- |
| Native shape | wrapper `definition`, `progression` | flat class record, `classFeatures`, `classTableGroups` | same imported shape, different values |
| Hit die / initial proficiency | `hitDie`, native grants | `hd`, `proficiency`, `startingProficiencies` | same fields, primary ability explicitly supplied |
| Resource table | native row keys, separate grants | known spells, Pact Magic slots and invocations | prepared spells, Pact Magic slots and invocations |
| First patron / subclass acquisition | 1 | 1 | 3 |
| First invocation count | 1 | 0 | 1 |
| Customization | separate patron/pact/invocation and first-party options | Pact Boon and invocation optional-feature progression | invocation optional-feature progression, Epic Boon feat progression |
| Class feature identity | explicit native IDs | 5etools-style UID plus explicit native catalog references | edition-specific UID plus explicit native catalog references |
| Starting equipment | absent from inspected base record | default prose, structured choices, gold alternative | choice prose and structured choices |
| Spell lists | only if provided by native content | 64 explicit spell references | 72 explicit spell references |
| Playtest status | existing native presentation | not applicable | not applicable |

Further observed class bundles: the 5e Fighter lacks a numerical classTableGroups table; 5.5e Fighter has a 20-row Second Wind / Weapon Mastery table. Both Wizard editions contain separate ordinary and spell-slot table surfaces. The model never fabricates missing statistics or copies another edition. Subclasses use their own feature tuples and their explicit parent class catalog references. Fate Condensed has no class surface.

## Complete class catalog audit

The pinned Core tree contains eight first-party base class records (Barbarian, Bard, Cleric, Druid, Rogue, Sorcerer, Warlock, Wizard), all wrapped in a native definition with a 20-row progression. Warlock alone supplies the inspected explicit playtest status. The other first-party definitions remain on the established native class reader; the imported adapters do not claim those records or infer their playtest readiness.

All twelve imported base class files and their accompanying subclass and feature records were inspected in each edition. The exact-reference audit checked 296 feature occurrences for SRD 5.1 and 307 for SRD 5.2.1 (603 total), with zero absent or ambiguous matches at the pinned source revision. The checked-in representative regression suite covers 140 of these occurrences; the wider 603-reference result is a source inspection, not an additional automated test count.

| Class | 5e numerical table groups | 5.5e numerical table groups | Spell-list level groups (both) | 5e optional-feature groups | 5.5e optional-feature / feat groups |
| --- | ---: | ---: | ---: | ---: | ---: |
| Barbarian | 1 | 1 | 0 | 0 | 0 / 1 |
| Bard | 2 | 2 | 10 | 0 | 0 / 1 |
| Cleric | 2 | 2 | 10 | 0 | 0 / 1 |
| Druid | 2 | 2 | 10 | 0 | 0 / 1 |
| Fighter | 0 | 1 | 0 | 1 | 0 / 2 |
| Monk | 1 | 1 | 0 | 0 | 0 / 1 |
| Paladin | 1 | 2 | 5 | 1 | 0 / 2 |
| Ranger | 2 | 3 | 5 | 1 | 0 / 2 |
| Rogue | 1 | 1 | 0 | 0 | 0 / 1 |
| Sorcerer | 3 | 3 | 10 | 1 | 1 / 1 |
| Warlock | 1 | 1 | 10 | 2 | 1 / 1 |
| Wizard | 2 | 2 | 10 | 0 | 0 / 1 |

Counts describe the actual imported records, not a normative assertion that all editions must have these surfaces. Some numerical tables use rowsSpellProgression rather than rows; the existing family model retains each published surface separately.

## Relationship and lifecycle decisions

* The class/subclass UIDs are not native IDs. Render their exact authored display names and levels. Use only IDs present in catalogReferences when resolving the feature; current imported IDs end in the authored feature level. On expansion, resolve same-level candidates through the pinned reader, verify the exact name, class, source (when supplied), subclass and level tuple, and accept exactly one match. The representative fixture regression covers 140 references across six class bundles; the full source inspection matched 603 across all 24 imported bundles. A UID remains a local UI occurrence key only.
* The imported base class records do not enumerate subclass or option native IDs. On expansion, page the authorized catalog and verify subclass reverse ownership or explicit feature-type/category membership, including available class/subclass ownership constraints. General feat categories are reference lists, not eligibility decisions. Render prerequisites without executing them. This fallback makes no inference about character choices and never reaches another ruleset.
* The class spell list is the explicit level-grouped spellList in the record. Links use exact qualified IDs; human-readable names are requested lazily from the same snapshot. If name resolution is unavailable, the existing explicit ID link remains.
* Imported reading state is isolated by readingKey(context, classId, "class"). Native feature retrieval checks exact snapshot and record identity; asynchronous commits require the current render lease and current mount. Legacy first-party class storage and links remain unchanged; first-party async customization/feature reads additionally avoid mutating detached hosted nodes. A future unified first-party navigation/state migration belongs with the navigation integration.
* All imported entry values are sent to B's integrated shared renderStructuredContent boundary with `{ input }`. No class-specific tag parser is implemented, and the pre-B fallback is not an acceptable integrated test outcome.
* The class registry slot registers structural imported classes/subclasses, imported class/subclass features and class-owned optional features. General feats and unrelated option records remain reference-workstream ownership. Entity attribution uses renderNativeAttribution; the dispatcher owns the package notice. The established first-party compatibility route is retained.

### Core relationship projections requested for follow-up

Expose explicit native feature IDs per class/subclass feature UID occurrence (including acquisition level, source and subclass-acquisition flag); explicit class-to-subclass edges; optional-feature and feat-category memberships and class/subclass relationships as lightweight catalog metadata; canonical spell-list entry display names. Current fixtures demonstrate that read-only reverse lookup and exact candidate resolution can work, but those projections would remove scanning and reliance on the current imported ID level suffix. They must be snapshot-bound and preserve source UIDs. No Rules Core edits or policy changes are authorized in D.

## Representative visual acceptance cases

Use the exact fixture-backed reader or an authorized dev-only context, not public endpoints. Test desktop 1440px and mobile 390px, with the real hosted ribbon when A is integrated.

| Case | Expected |
| --- | --- |
| Dorks & Dice Warlock | Existing Alpha status, progression, patron, pact, invocations, current option filters and return links remain intact |
| 5e Warlock | Level-one patron, level-two invocations, Pact Boon at level three, known-spells table, 64 spell-list entries; Fiend detail points to the same catalog |
| 5.5e Warlock | Level-one invocation, level-three subclass, prepared-spells table, Epic Boon, 72 spell-list entries; no 5e content |
| Both Fighters | 5e feature reading without invented numerical table; modern Second Wind and Weapon Mastery table |
| Both Wizards | Both published table surfaces independently readable; level-grouped spells |
| Fiend and other subclasses | Parent class, expandable feature levels, same-catalog deep links |
| Return and switch | Open feature, follow full reference, return to same snapshot; change edition/fingerprint while pending and verify stale content never appears |
| Narrow reader | Responsive existing section selector, horizontally scrollable tables, visible focus/keyboard targets; no body horizontal overflow |
| Fate Condensed | No fabricated class or mandatory class navigation |

Automated DOM tests cover structure, relationships, reading state and lifecycle. They are not a substitute for visual browser acceptance. Run the existing class reading suite and the fixture-driven multi-system class suite as separate npm test processes. B's rich structured renderer and A's authorized navigation are integrated; hosted browser verification of the cases above remains required. No production deployment or access-policy modification.

## Workstream validation record

The implementation candidate `55a9631f71a234d3422422add052cb4d349c78cf` passed the complete Validate Rules Wiki workflow ([run 45691181203](https://github.com/LegendMaster03/dorks-and-dice-rules-wiki/actions/runs/45691181203)): 11 C# tests, browser syntax and native-first contracts, the existing first-party class reading tests, the new 140-relationship fixture regression, deployment guards, Compose validation, container build and stateless host smoke test. The preceding run detected a disclosure syntax error, corrected at this candidate. Visual acceptance on actual browser viewports remains open pending integrated A/B; this run does not grant foreign runtime access or authorize deployment.

## Integration reconciliation

All class content passes `{ input }` to the shared structured renderer; explicit related links use its scoped reference helper. Each mounted class view shares one lazy catalog read per related category across its option groups, with retry after failure and no global cache. The 5e Warlock Pact Boon regression verifies that opening a second group does not repeat the optional-feature catalog requests. Reverse category lookups still require native Core relationship projections to avoid full category scans; no new API or policy is introduced here.
