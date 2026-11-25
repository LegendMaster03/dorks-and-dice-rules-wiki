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

## Relationship and lifecycle decisions

* The class/subclass UIDs are not native IDs. Render their exact authored display names and levels. Use only IDs present in catalogReferences when resolving the feature; current imported IDs end in the authored feature level. On expansion, resolve same-level candidates through the pinned reader, verify the exact name, class, source (when supplied), subclass and level tuple, and accept exactly one match. The fixture audit checked 140 references across six class bundles without mismatch. A UID remains a local UI occurrence key only.
* The imported base class records do not enumerate subclass or option native IDs. On expansion, page the authorized catalog and verify subclass reverse ownership or explicit feature-type/category membership, including available class/subclass ownership constraints. General feat categories are reference lists, not eligibility decisions. Render prerequisites without executing them. This fallback makes no inference about character choices and never reaches another ruleset.
* The class spell list is the explicit level-grouped spellList in the record. Links use exact qualified IDs; human-readable names are requested lazily from the same snapshot. If name resolution is unavailable, the existing explicit ID link remains.
* Imported reading state is isolated by readingKey(context, classId, "class"). Native feature retrieval checks exact snapshot and record identity; asynchronous commits require the current render lease and current mount. Legacy first-party class storage and links remain unchanged; first-party async customization/feature reads additionally avoid mutating detached hosted nodes. A future unified first-party navigation/state migration belongs with the navigation integration.
* All imported entry values are sent to the existing shared renderStructuredContent boundary. Workstream B must supply the final rich-entry/tag implementation and coordinate its context argument. No class-specific tag parser is implemented. The safe foundation fallback is intentionally inert until that integration.
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

Automated DOM tests cover structure, relationships, reading state and lifecycle. They are not a substitute for visual browser acceptance. Run the existing class reading suite plus the new fixture-driven module through npm test; final integrated acceptance requires B's rich structured renderer and A's authorized navigation, along with browser verification of the cases above. No production deployment or access-policy modification.
