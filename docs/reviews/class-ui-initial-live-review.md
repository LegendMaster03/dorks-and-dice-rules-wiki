# Rules Wiki Class UI — Initial Live Review

**Review date:** October 30, 2026  
**Status:** Desktop live investigation complete; responsive and broader accessibility acceptance remain incomplete. This report does not approve implementation or release readiness.  
**Wiki baseline:** `f5f19a8d7e516b44b28ae99cd87f913f1e9f4b0e` ([PR #26](https://github.com/LegendMaster03/dorks-and-dice-rules-wiki/pull/26)).  
**Core repository snapshot:** `bec97a8ca48e04dfa62631a0493056b5a2a95c05`.  
**Live entry point:** https://dorks-and-dice.com/tools/rules-wiki

## 1. Executive Summary

The deployed class reference is usable through manual disclosures, but its advertised navigation does not reliably take the reader to a feature or section. In repeated Warlock tests, fragment links changed the URL while rebuilding the class in its initial state. Expanded options and filters disappeared, the requested feature remained closed, and the viewport returned to the class header. This is the highest-priority confirmed Wiki defect.

The renderer successfully discovers the reorganized native Warlock content. All 43 customization options—one Patron, four Pacts, and 38 Invocations—were expanded and returned details without an unavailable message. All 18 base features also loaded manually. The catalog is not missing merely because records were split into separate files.

The reading experience remains inconsistent. The Fiend's essential feature and spell-grant rules are buried in a second disclosure and displayed as deeply nested field/value data. Wizard customization exposes implementation keys and booleans in the main reading flow. Barbarian skill choices display technical IDs. Feature summaries also retain names derived from IDs even after the authoritative name has loaded.

A separate Core content inconsistency omits repeated Ability Score Improvement grants from Warlock advancement. Fixing Wiki navigation will not repair that data discrepancy.

No Critical finding was established. There is one High Wiki defect, three Medium Wiki defects, one Low Wiki defect, and one High Core dependency. Default advancement column selection and filter density are design recommendations, not approved defects.

**Readiness judgment:** Keep this interface available for development review, but do not describe it as having passed class-reference acceptance. The four-size responsive requirement, full keyboard traversal, error recovery, and screen-reader checks are still open.

## 2. Audit Scope and Methodology

### Live conditions and coverage

The live site was accessible in the existing signed-in Chrome session. Its rendered DOM and screenshots were the primary evidence; repository code was used to explain observed behavior. The site was not replaced with a standalone preview.

| Area | Inspected | Result or limit |
| --- | --- | --- |
| Viewport | 1363 × 936 CSS pixels | One desktop/laptop-sized viewport; screenshot raster dimensions can differ |
| Warlock summary | Traits, status, navigation, initial and expanded states | Inspected live |
| Warlock advancement | 20 rows, focused and all-column views, level selection, fragment feature links | Inspected live; navigation failure reproduced |
| Warlock features | All 18 native base-feature disclosures | All loaded manually without unavailable messages |
| Warlock customization | Fiend, Blade, Chain, Talisman, Tome, all 38 Invocations | All 43 options loaded without unavailable messages |
| Invocation filters | Show all, Pact filter, level filter, combined name/Pact/level filter | Blade returned 3; Blade plus level 5 returned Eldritch Smite; name search retained that result |
| Wizard | Traits, customization, 20-level advancement, level focus, spell-slot matrix | Shared problems identified; not every Wizard feature expanded |
| Barbarian | Traits, customization status, 20-level advancement and feature-group organization | Shared skill-summary problem identified; not every Barbarian feature expanded |
| Keyboard | Enter toggling of Eldritch Smite, feature activation, Tab to a full-rule link | Basic operation works; complete keyboard acceptance not claimed |
| Responsive | Wide desktop, tablet, narrow mobile | Not verified: supported browser interface exposed no viewport-resize or device-emulation operation |
| Fault handling | Natural loading states observed | No controlled outage, denied-response, or retry test performed |

The browser automation runtime timed out during a large option-expansion batch. The existing page was recovered, remaining disclosures were inspected, and final counts were verified. This was an audit-tool limitation, not classified as a site defect.

### Source material reviewed

- `docs/class-ui-development-plan.md`, including its development-deployment acceptance boundary and unresolved decisions.
- PR #26 metadata and patch.
- `src/RulesWiki.Web/wwwroot/native-class-detail.js`, `native-class-customization.js`, `native-class-detail.css`, and `native-rule-detail.js`.
- `tools/validate-native-class-renderer.mjs`: synthetic DOM tests cover nesting, option discovery, filters, caching, retry behavior, and progression reveal callbacks. Their isolated event invocation does not establish correct behavior through the hosted shell.
- Supporting `app.js`, `authoring.js`, routing and reference-enhancement modules.
- Core's native Warlock base record, aggregate class-feature file, Agonizing Blast record, Wizard and Barbarian base records, and repository tree.

The Wiki repository snapshot matches the requested merge commit. The live application's exact deployed build identifier was not independently exposed or verified. Core repository contents were compared with rendered values; raw authenticated API payloads were not separately exported. No claim is made that an entire source snapshot was byte-compared with the deployed API.

### Evidence package

Screenshots and text evidence are committed under `docs/reviews/evidence/`. The accompanying archive preserves the same relative layout. Screenshots show the actual hosted pane, including surrounding index context. Text exports capture rendered rules rather than API payloads.

## 3. Findings Summary

| ID | Finding | Severity | Classification / scope |
| --- | --- | --- | --- |
| UI-01 | Fragment navigation resets class state and fails to reveal the target | High | Confirmed live; shared class navigation path, reproduced on Warlock |
| UI-02 | Essential Patron mechanics are buried and compressed by recursive rendering | Medium | Confirmed live; generic option renderer, demonstrated by Warlock Fiend |
| UI-03 | Wizard customization presents technical configuration as primary rules | Medium | Confirmed live; shared fallback rendering |
| UI-04 | Barbarian skill choices expose identifiers and object syntax | Medium | Confirmed live; shared trait normalization |
| UI-05 | Feature summaries retain ID-derived names after canonical names load | Low | Confirmed live; shared feature renderer |
| CORE-01 | Warlock progression omits repeated Ability Score Improvement grants | High | Confirmed repository/rendered-content discrepancy; Core dependency |

Severity follows impact on rules lookup. Presentation findings do not imply that the underlying mechanics are absent.

## 4. Detailed Findings

### UI-01 — Fragment navigation resets class state and fails to reveal the target

**Severity:** High. **Component:** Class section links and advancement feature anchors. **Scope:** Shared implementation; reproduced repeatedly on Warlock. **Conditions:** Hosted Chrome, 1363 × 936.

**Expected:** A section link scrolls within the current class. A progression feature link opens its level group and feature disclosure, brings the rule into view, and preserves unrelated browsing state.

**Actual:** Clicking Patron Choice and, in a later independent reproduction, Pact Magic changed the URL fragment but returned the view to the Warlock header. The requested feature was closed. Previously open Pact/Invocation systems and option details were reset. The Invocation search control disappeared with its collapsed system. A Features by level section-link test also ended with the destination below the viewport rather than in view.

**Reproduction:**

1. Search Warlock in the Rules index and select the Class result.
2. Expand Invocations, show all options, and expand an option.
3. Optionally set name search to Smite, required Pact to Blade, and documented level to 5.
4. Click Pact Magic in advancement.
5. Inspect the new fragment, current scroll position, open disclosures, and target feature.

**Evidence:** [State before and after](evidence/class-audit-navigation.json), [post-click screenshot](evidence/class-audit-navigation-reset.jpg). After the final reproduction the fragment was `#native-class-feature-class-feature.warlock.pact-magic`, the target's `open` property was false, and its top was about 2334 CSS pixels below the viewport origin.

**Cause:** A render/navigation integration problem is strongly indicated. The local class callback opens nested disclosures, but that state does not survive hosted navigation. A shell-level navigation handler or remount is a hypothesis; the exact owner was not established. Do not treat a particular router fix as proven.

**Remediation:** Make same-class fragment movement preserve the current renderer instance or restore state after navigation. Reveal nested disclosures before scrolling and preserve useful keyboard focus. Do not bypass ordinary full-rule routing.

**Acceptance:** In the hosted application, verify mouse and keyboard section/feature links, repeated clicks, Back/Forward, fragment entry, preserved filters, and return from a full rule. Add an integration test through the real link-routing boundary; an isolated callback test is insufficient.

### UI-02 — Essential Patron mechanics are buried and compressed by recursive rendering

**Severity:** Medium. **Component:** Native customization option body. **Scope:** Shared renderer with a substantial Warlock-specific impact. **Conditions:** Same desktop viewport.

**Expected:** Opening The Fiend exposes its usable Patron features and spell grants in a readable class-reference layout. Feature names and levels organize the text; provenance remains secondary.

**Actual:** Opening The Fiend initially shows only a brief design/status description. Its six feature entries and spell-grant schedule require opening Full requirements and mechanics. That disclosure renders Features → list → Level/Name/Description as nested definition lists. Description text occupies a narrow right-side column despite the available pane width. Spell access also includes values such as `automatic-known-no-ordinary-selection-cost` and `expanded-choice-from-same-13-spell-list-not-simultaneous`.

**Reproduction:** Open Warlock → Patron → The Fiend → Full requirements and mechanics.

**Evidence:** [Initial Patron detail](evidence/class-audit-fiend.jpg), [nested mechanics](evidence/class-audit-fiend-mechanics.jpg). The live expanded text included Dark One's Blessing, Dark One's Own Luck, Infernal Retaliation and improvements, Hurl Through Hell, and the spell grant schedule. These are present, not missing content.

**Supported cause:** `native-class-customization.js` `renderOption` renders description separately and sends every remaining property to generic `renderValue` inside a technical-details disclosure. It does not distinguish primary feature/spell rules from supplementary metadata.

**Remediation:** Present published feature entries as level/name headings with full-width prose and published spell grants as a compact level table/list. Preserve unrecognized data in secondary details. Do not duplicate definitions into the base class or infer mechanics.

**Acceptance:** All Fiend feature and spell-grant text remains accessible; opening the Patron makes its actual play rules readily discoverable; no new grants are inferred.

### UI-03 — Wizard customization presents technical configuration as primary rules

**Severity:** Medium. **Component:** Class customization fallback fields. **Scope:** Shared framework, observed on Wizard. **Conditions:** Same desktop viewport.

**Expected:** Defined selection rules are explained as readable reference text. Deferred mechanics are identified without presenting internal configuration as a finished choice catalog.

**Actual:** The first customization content is a long field/value listing including Selection List Id, Additional To Other Class Grants = true, Ordinary General Feat May Be Replaced By One Eligible Specialization Option = true, Effect Definitions = shared-option-catalog, and No Mechanical Powers Invented = true. This dominates the page before advancement. Companion path similarly exposes implementation markers.

**Reproduction:** Search Wizard → select Wizard Class → read Class customization.

**Evidence:** [Wizard screenshot](evidence/class-audit-wizard.jpg). Native Wizard content confirms those values exist; the Wiki is exposing their storage form.

**Supported cause:** `renderClassCustomizations` sends recognized legacy/fallback customization fields directly to generic `renderValue`.

**Remediation:** Format existing Wizard grant levels, eligible option families, prerequisite rules, and companion-path status as concise readable rules. Move storage identifiers and implementation notes to secondary details. Do not fabricate the deferred shared option catalog.

**Acceptance:** The main section explains selections at published levels 5/10/15/20 without raw booleans or compound technical keys. Deferred details remain accurately marked.

### UI-04 — Barbarian skill choices expose identifiers and object syntax

**Severity:** Medium. **Component:** Class traits / skill choices. **Scope:** Shared data normalization; observed on Barbarian.

**Expected:** A readable choice sentence using skill names, consistent with Wizard and Warlock.

**Actual:** Barbarian displays “Choose: 2; From: skill.animal handling, skill.athletics, skill.intimidation, skill.nature, skill.perception, skill.survival.”

**Reproduction:** Search Barbarian → select Barbarian Class → inspect Skill choices.

**Evidence:** [Barbarian screenshot](evidence/class-audit-barbarian.jpg). Native Barbarian uses `{ choose: 2, from: ["skill.animal-handling", ...] }`; Wizard/Warlock use `count` and bare names.

**Supported cause:** `renderSummary` recognizes only the `count` shape. The fallback `valueLabel` serializes the object and replaces hyphens, leaving the `skill.` prefix intact.

**Remediation:** Normalize the two published choice-count shapes at the presentation boundary and resolve/display human-readable skill names. Preserve identities for any links. Unknown shapes must retain data without looking like a valid choice sentence.

**Acceptance:** All three inspected classes display correct counts and readable names; multiword skills retain proper spacing.

### UI-05 — Feature summaries retain ID-derived names after canonical names load

**Severity:** Low. **Component:** Advancement labels, level previews, feature summaries. **Scope:** Shared feature renderer.

**Expected:** Available authoritative names consistently identify the same feature throughout the reference.

**Actual:** Summary Patron Choice expands to heading Otherworldly Patron; Pact Choice expands to Pact Boon; Mystic Arcanum 8 expands to Mystic Arcanum (8th). The sidebar uses the canonical names. Loading the definition does not update the summary or progression label.

**Reproduction:** Open the Warlock Patron Choice, Pact Choice, or Mystic Arcanum disclosure manually and compare its summary with the loaded heading and index entry.

**Evidence:** [Feature-label screenshot](evidence/class-audit-feature-labels.jpg), [rendered feature text](evidence/class-audit-warlock-features.txt). The screenshot demonstrates the Mystic Arcanum naming mismatch and repeated technical status fields.

**Supported cause:** `featureName(id)` generates labels from ID suffixes. Successful `renderFeature` lookup inserts a canonical heading but leaves earlier labels unchanged.

**Remediation:** Reuse available canonical metadata and update labels after lookup while keeping stable native IDs and fragment targets. Avoid eager loading of every feature solely to rename a label.

**Acceptance:** Canonical names agree across summary, loaded heading, and any labels that have authoritative metadata; fallback labels remain available before metadata loads.

## 5. Shared Architecture Findings

The main weaknesses are at presentation and host integration boundaries:

- Local renderer tests establish callback behavior but do not cover the hosted router interaction demonstrated by UI-01.
- Generic recursive rendering is still used for substantial class content. It preserves data but does not provide a usable reading hierarchy for complex rules (UI-02/UI-03).
- Trait normalization assumes one content shape despite multiple active native shapes (UI-04).
- ID-based fallback labels are never reconciled with loaded canonical names (UI-05).

The framework does not force every class into Warlock's three systems. Wizard and Barbarian use different content, and absent subclass content is not silently converted into a Fiend preset. This behavior should be preserved.

## 6. Warlock-Specific Findings

Discovery of the split native catalog worked. The final live check showed 43 open option disclosures, zero loading messages, and zero unavailable messages. Invocation relationships showed Blade 3, Chain 3, Tome 2, and no specific Pact listed 30. All 38 catalog names were inspected, including entries beyond the initial 12.

All 18 native base features loaded manually. [Expanded customization text](evidence/class-audit-warlock-expanded.txt) and [expanded feature text](evidence/class-audit-warlock-features.txt) document the returned rules. These exports do not include every second-level technical disclosure.

Earlier concerns were re-evaluated:

| Earlier concern | Current live result |
| --- | --- |
| Excessive trait whitespace | Compact trait strip substantially addresses it on this viewport |
| Customization buried below advancement | Addressed: customization precedes advancement |
| Long ungrouped feature list | Addressed structurally by level disclosures |
| Excessively technical default table | Reduced by focused columns; column choice still warrants review |
| Technical fields without interpretation | Still present in important expanded rules and Wizard fallback |
| Weak Patron/Pact/Invocation relationship explanation | Improved: distinct descriptions, free first Pact note, acceptance/attachment rules, and Pact filters |
| Missing options after folder split | Not reproduced; current options discovered successfully |

No preset membership was present in the inspected Warlock class record, and the native tree contained no clearly named preset artifact. The UI's no-presets message is consistent with the inspected inputs. This is not a missing-preset UI finding; a repository tree alone does not prove that no semantically equivalent record could exist under another name.

## 7. Rules Core Dependencies

### CORE-01 — Repeated Warlock Ability Score Improvement grants are absent from advancement

**Severity:** High. **Scope:** Core content, visible through Wiki progression and feature grouping.

**Expected:** Class progression and the feature's published grant schedule agree.

**Actual:** The native feature description specifies Warlock levels 4, 8, 12, 16, and 19. The base class's `progression[].featureGrants` references `class-feature.warlock.ability-score-improvement` only at level 4. Live advancement shows level 8/16/19 as blank, level 12 only as Imbue Item, and no corresponding repeated ASI feature groups. Selecting Focus level 8 leaves no open feature group.

**Reproduction:** Compare the live 20-level table with the manually opened Ability Score Improvement definition, then compare the native base progression with `native/features/classes/warlock/features.json`.

**Evidence:** [Default progression screenshot](evidence/class-audit-progression-table.jpg), [rendered ASI description and advancement](evidence/class-audit-warlock-features.txt).

**Cause:** The two authoritative content locations are inconsistent. Wiki is displaying the supplied grant arrays; it must not manufacture the missing grants.

**Remediation:** Reconcile the schedule in Core. After any approved content correction, also verify Wiki repeated-feature handling: `renderFeatures` deduplicates IDs, so adding the same ID at multiple levels may still omit later descriptions/groups. That follow-on risk is supported by code, but was not reproduced against changed content and is not counted as another confirmed defect.

**Acceptance:** Table, level focus, feature grouping, and feature prose agree at all five levels without defining mechanics in Wiki.

Other dependencies:

- The current category scan plus detail ownership checks successfully located native options. A class-scoped metadata query could reduce requests, but no measured performance defect or API change is established by this audit.
- Wizard shared metamagic/crafting and companion mechanics are explicitly deferred in the native record. Their absence is not a license to invent choices.
- Warlock base content does not supply starting equipment. An absent equipment summary is therefore not classified as a renderer omission.
- All class rules remain experimental. Experimental status is not an exclusion criterion for coherent native rules.

## 8. Design Recommendations

These are proposals for review, not confirmed broken functionality or approved changes.

**D-01 — Reconsider focused progression columns.** Warlock's default table shows proficiency, Pact slots, and slot level while hiding Invocation count, cantrips, and spells known. Wizard defaults to Cantrips/BAB/Fortitude, with Reflex and Will hidden. The universal “first three preferred fields” policy produces uneven reference priorities. Define class-aware priorities from approved metadata or offer a compact resource view. The all-columns control does expose the data.

**D-02 — Reduce filter machinery for tiny catalogs.** One Patron receives a search box, 20-level selector, explanatory text, and matching counts. Four Pacts repeat the same machinery. Consider showing these controls only when the catalog warrants them, keeping prerequisites visible. Do not weaken Invocation filtering.

**D-03 — Separate play rules from development metadata.** Repeated Alpha/Rules Status fields, implementation markers, and authoring descriptions increase reading length. Keep a clear class-level playtest status and place additional provenance behind a compact disclosure. Do not discard substantive limitations.

**D-04 — Review the shell's scroll model after responsive testing.** The host has document, index, detail, and table scrolling. This is visible, but nested scrolling alone is not classified as a defect. Test actual mobile navigation, sticky table behavior, and expanded-rule readability before prescribing a full-width reader or new pane architecture.

## 9. Recommended Remediation Sequence

1. Repair UI-01 and add a hosted navigation integration test. This restores primary rules lookup and prevents state resets from obscuring later verification.
2. Reconcile CORE-01 with the content workstream; verify repeated-grant rendering in Wiki before declaring the schedule fixed.
3. Group UI-02/UI-03 into a rules-presentation pass: primary mechanics, named features, spell grants, and technical metadata separation. Keep class-specific shapes distinct.
4. Fix UI-04 and UI-05 as presentation-boundary changes with fixtures drawn from actual native data.
5. Resolve D-01/D-02 with user review. Neither is authorization to build a character selector.
6. Run responsive and accessibility acceptance in the actual host at 1920 × 1080, 1366 × 768, 768 × 1024, and 390 × 844. Recheck filtered/expanded catalogs and both table modes.
7. Exercise controlled errors and recovery, then repeat the key Warlock/Wizard/Barbarian navigation and content checks.

No implementation, Core content, deployment, or environment configuration changes were made for this review.

## 10. Verification Gaps

- Only one viewport was available. Wide desktop, tablet, narrow mobile, touch interaction, and their screenshots remain outstanding. CSS inspection is not responsive acceptance.
- Screen-reader announcements, complete Tab order, contrast measurements, 200% zoom, and reduced-motion settings were not comprehensively tested.
- Transient failures, snapshot mismatch handling, retry controls, and permission errors were inspected in source tests but not induced live.
- Full-rule return-state behavior and browser Back/Forward require a focused acceptance pass after UI-01 is fixed.
- Not every second-level mechanics disclosure was expanded; the Fiend's full mechanics were inspected, and all option descriptions loaded. The catalog check is not a complete independent rules correctness audit.
- No raw API snapshot, network request count, or latency benchmark was captured. No quantitative performance conclusion is warranted.
- No application test suite was executed as part of this documentation-only review. Existing synthetic tests were inspected, not represented as live acceptance.
- No public/unauthenticated-access or security assessment was performed.
- Exact deployed build identity remains unverified independently of repository baseline and visible behavior.

## Uncertain Observations and Decisions Requiring Review

- The precise layer causing UI-01 is not yet proven. Investigate host navigation interception/remount behavior before changing renderer callbacks.
- The best default progression columns and the threshold for displaying filters are design decisions.
- Whether complete option mechanics should open immediately, or retain a secondary disclosure with better semantic layout, needs review. The current compressed nested layout is the confirmed problem.
- A future preset contract remains a Core/Wiki coordination decision. No preset should be inferred from a Patron.
- The earlier development-plan statement describing the alpha as a fixture is superseded by later sections acknowledging native publication. It should not be used to withhold current native rules.

**Completion boundary:** The desktop report and evidence are ready for review. The requested multi-viewport audit is not complete, and no claim of comprehensive release acceptance is made.
