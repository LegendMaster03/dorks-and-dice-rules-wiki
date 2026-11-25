# Multi-system Wiki integration review

## Scope and evidence

The review targets `feature/wiki-multi-system-integration`. Wiki baseline `0115e131d2cb4c5a9306b5cb8e6de8d3ffc1de27`; verified foundation including F/G `4c15cac665e96cf9cea4a3ddd046e0c739e399d7`. Rules Core fixture baseline/main `6a300933435c633b51f1d446fca09b9810dceb9e`; compatible manifest-metadata PR #212 candidate `5031b7db48391b7dc84f10218a6cd3aae1012fae`; Site main `aa15e85c5edf032275320b20442fe6c09501be5f`. These are review-time revisions, not evidence of deployment. The final PR records the exact integrated head and workflow runs; a document inside a commit can not record its own resulting commit hash.

Original A–E heads and corrected integration candidates were independently reviewed against their reports, source diffs, active contract and executable CI. The earlier assignment text for every independent chat was not recovered; the consolidated assignment, workstream reports and implementation evidence were used. Representative authored fixtures and synthetic negative cases are deliberately distinguished. CI verifies fixture behavior and host boundary tests, not a real hosted session or exhaustive source fidelity.

## Workstream disposition and integration order

All A–E workstreams originated at the verified F/G foundation. F/G were already reconciled; do not reopen G's design proposals or change policy.

| Workstream / PR | Original reviewed head / CI | Accepted workstream head / CI | Integration commit / CI | Disposition |
| --- | --- | --- | --- | --- |
| B / #44 | `34aa23d428a3260dc53686d70a82c7b6bc557458` / 45696957423 failed | `dd5584cb58a02c787a916934efcdddad89f1f705` / 45699461667 passed | `7c5e8d4818c16e6eada00f87f9a1b2ae4e8b23e4` / 45699731654 passed | Fixed DOM harness and shared inline/reference exports; integrated first. |
| A / #43 | `9c2bb5f6b339287e31c7aa4c7cd8c98dd65017d3` / 45695734244 passed | `3f486da0cfadafb8a28ce4c9b59c60b98f7194f3` / 45699820047 passed | `3d4761a746a538f53d1db8068ac16f00354f5c21` / 45700055025 passed | Reader-scoped bounded cache, sanitized history and revalidation; retained B tests. |
| C / #41 | `c45f918b64b24801a28679e5be720ebf5a0e36f2` / 45697181661 passed | `d03a0fa6a26600a3e0d3afa58a0fae3e154c2130` / 45700034596 passed | `91e4d73d689e8c899fb0a3381750eed2c38203a2` / 45700428034 passed | Shared structured rendering and bounded roll callbacks replace duplicate parser; structural imported selection; mandatory source-link tests. |
| D / #42 | `7aaf897845cf85d886a237ff18d5f8512c1a9752` / 45691427376 passed | `c8c157f7d9bdae2da7eac0422ded7afd9a2264a9` / 45700177958 passed | `b4b094c922cda9b285ea77dee3c81b66c491c238` / 45700686259 passed | Fixed structured input, common links, repeated option scans, page validation; preserved first-party reading tests. |
| E / #45 | `28b827196fcbccec3d512cd80a108d1155aabe70` / 45698276543 passed | `5e5e21e255479a1f606270c8cf45e02ea70cbc0d` / 45700635638 passed | `e7011aaee0651107f3f3b6c465a74b30bbd2028b` / 45701583116 passed | Shared scoped reference helper, compatible flat schema selection, mandatory B contract, fixed NodeFilter DOM harness after integration. |

GitHub Actions links use https://github.com/LegendMaster03/dorks-and-dice-rules-wiki/actions/runs/{runId}. The foundation F/G reconciliation was already validated (45690026962, 45689949803, 45689732372, 45689519451); F PR #39, reconciliation PR #40. Core PR #212 exact-head CI: 45686430637, 45686430813, 45686430625, 45686430686 all passed. Core main remains unchanged.

Combined review changes: `4e7816466ac58b87ee8b1c4f5361b39437a8d4f6` (45701713233 passed) prevents local links/reads from foreign-scoped structured subtrees, including table rows, and makes integrated tests mandatory. `184d4307588882945baee13d10a29e3245263784` (45702006679 passed) also excludes foreign definition-wrapper candidate references and tightens server route validation before ticket exchange: strict native IDs, exact three route shapes, no dot-segment normalization or path-prefix aliases. These are confirmed correctness and boundary defects, not new authorization policies. No runtime policy, game mechanics, native catalogs, publication settings or deployment were modified.

## Architecture and coverage

One native browser and one reader/registry/lease/structured renderer are shared across systems. The first-party adapter retains its compatibility layouts where a structural adapter does not own the record. Specific class options have priority over the generic reference adapter; equal-priority conflicts fail explicitly. Unknown shapes remain readable through the generic renderer. Historical resolved-rule and authoring modules remain inactive.

| Family | Integrated fixture evidence | Ownership / limitation |
| --- | --- | --- |
| Discovery, navigation, search, pagination | All four catalogs, shared Warlock IDs, authorized/denied routes, unknown categories, history, late response and changed fingerprint, bounded synthetic large catalog | A; live session and exact runtime catalog identity pending |
| Structured content | Nested lists/tables, named entries, safe inline tags/dice labels, Fate Markdown, malicious HTML and URL handling, exact reference mapping and scope | B; intentionally bounded Markdown subset and reference candidates, unresolved labels stay text |
| Creatures | Both Werewolves, Avatars of Death, dragons, spellcasters, variants/summons; first-party Goblin Warrior and Tarrasque; synthetic Kaiju separately labeled | C; no real native multipart fixture; no invented values |
| Classes | Three Warlocks, both Fighters/Wizards, subclasses/options, authored progression, 140 fixture feature relationships; first-party customization and reading return | D; broader source audit in D report, not exhaustive hosted validation |
| Spells, items and qualifications | Acid Splash in both editions, item group/template/variant, weight/value/AC/mastery, first-party qualification groups | E; no fabricated first-party spell/item inventory |
| Origins | Imported Human/Acolyte; native Human, Drow, Acolyte, inheritance and origination methods; construct categories | E; native Four Pillars remain distinct, loader-expanded projections need hosted verification |
| Conditions, skills, competencies | Three Exhaustion presentations; Athletics across systems, native skills/families/competency links | E; first-party semantic condition renderer retained |
| General reference | Feats, options, tables, page text, glossary, language, sense, hazards, Fate chapters/actions/ratings/stress | E and generic fallback; representative source coverage, not all shards |
| Package and entity provenance | Four descriptor fixtures, missing/wrong/stale metadata, exact once per detail | F; full live metadata requires Core #212 |
| Custom/campaign | Historical architecture and ownership recovered | G; no restoration, writes, or frontend resolution approved |

The workstream reports provide record-level cases and source provenance. All three Warlocks have the same local ID but separate context/reader/state; SRD 5.1 and 5.2.1 source values are not interchangeable. The existing first-party class, conditions, monster, Kaiju, and native browser regression tests remain maintained. CI includes real DOM fixtures with mock Core responses; actual desktop/mobile layout and the Site-hosted ticket exchange are independent acceptance obligations.

## Security and runtime contract

Browser transport is the finite named-operation path under `/_rules-wiki/operations/{operation}`; the Site upstream host path wraps it. The private server client permits only native discovery, search and detail GETs; IDs and path shapes are validated before exchange. No public Core route, browser-supplied host/method, transparent proxy, credential propagation to browser, or general API was added. C# tests cover unauthenticated denial, allowlist, invalid arguments, no-store, exact target introspection and pair-specific ticket exchange with test handlers. Core private endpoint tests cover actual public/private HTTP ingress policy. Fixture tests cover denied discovery, stale snapshots and async leases, package isolation and inert content. No live Site ticket exchange, cross-session browser behavior or actual deployment configuration has been verified by this review.

Private Core requires the first-party configured default, `PrivateOnly` surface, Site mode `dorks-and-dice`, trusted private source `rules-wiki`, and existing distribution authorization. Foreign catalogs remain subject to Core's package-specific enabled flag, exact approved digest, rights-review reference and attribution statement. An isolated test environment may use existing test-only approved configuration; do not change deployment/publication policy. The manifests in the pinned Core tree are Dorks & Dice, D&D SRD 5.1 (CC BY 4.0), D&D SRD 5.2.1 (CC BY 4.0), and Fate Condensed (CC BY 3.0). Existence in the repository is not permission to distribute. Core main lacks the optional descriptor metadata projection; no license is invented in Wiki.

Exact runtime SHA-256 catalog fingerprints were not obtained: loader diagnostics in SRD review CI describe separate generated review catalogs, not the authoritative native runtime tree. The acceptance tester must run the authoritative loader from the pinned Core checkout for all four IDs and compare the returned permitted descriptor, search, and detail fingerprints. No synthetic fixture or source-PDF digest can substitute.

```sh
for id in first-party-001 dnd-5e dnd-5-5e fate-condensed; do
  dotnet run --project tests/NativeCatalogFingerprint/NativeCatalogFingerprint.csproj --configuration Release -- data/rulesets "$id"
done
```

This is a read-only local diagnostic from the Core repository root; it does not approve distribution. Site configuration contracts are `docs/tool-authentication-contract.md` and `docs/private-tool-tunnels.md` at the Site revision above; Core's `docs/private-tool-tunnel-deployment.md` describes split ingress. Use an isolated Site/Tool Host, pair network, restricted control plane, private Core, and corresponding normal public ingress when verifying separation. Keep credentials server-side; redact tickets and secrets in evidence.

## Performance and consolidation

Measured fixture operation budgets: fresh foreign home = discovery + bounded facet read (2); ordinary all/category page = 1 search, plus one selected detail when needed; first-party compatibility families = at most 3 search streams; first-party home may read one class page and up to 10 class details; fresh recent labels up to 8. A's reader-scoped history cache is capped at 64. D's initial imported class mount reads no feature definitions; explicit option expansion may scan the relevant category once per mounted view, reused across groups; spell label lookups use bounded concurrency. B's optional inline resolver is capped at 64 relevant exact candidates; large/unknown lists remain readable without links. Each real named operation implies one target ticket exchange. These are fixture measurements or code bounds, not live tunnel latency/traffic. Core relationship projections and optional row summaries would reduce remaining scans and label retrieval. No independent transport or speculative relationship inference was added.

The integrated npm test suite keeps the first-party behavioral regressions, real DOM navigation/rendering, fixture provenance, negative/security cases, exact relationship assertions, and bounded request checks. Removed temporary fallback/file-existence guards, redundant basic table checks, one identical Sorcery points assertion and redundant static implementation-string checks already established by executable browser/dispatcher tests. The imported class suite runs independently rather than inheriting a previous DOM process. Static architecture guards with distinct purpose remain; separate existing Phase 3A workflow is retained because changing existing PR check requirements is not needed for this pass. Dormant historical standalone validators are not claimed as active CI coverage, and no unrelated authoring suite was deleted. Full exact-head CI is required for the final commit.

## Remaining acceptance and merge gates

1. Verify final Wiki head and both relevant PR workflows. Record exact compatible Core and Site revisions; full live attribution uses PR #212 candidate.
2. Independently test through the actual Site Tool Host and private Core tunnel in an isolated permitted configuration. Compare authoritative loader fingerprints, inspect actual requests/responses, test all four systems where policy permits, test denied and unauthenticated routes, verify no leaked private credentials, and exercise desktop/mobile/keyboard/navigation and actual source content. Record blockers explicitly rather than treating mocked or unavailable tests as passed.
3. Confirm first-party regressions and native multipart fixture distinction. Test package metadata with the compatible Core revision and missing metadata with the old contract if practical. Do not change publication, entitlement, campaign architecture, or production.
4. Remediate confirmed defects on the integration branch, revalidate exact head, and obtain owner merge approval. The PR is not a deployment or main merge authorization.

Nonblocking limitations: heterogeneous and partially imported catalogs; no complete shard-by-shard publisher fidelity audit; no actual native Kaiju record; exact-token links only where authoritative mapping exists; bounded fallback relationship scans; no campaign writes or comparison restoration. Hosted environment availability, current actual authorized ruleset list/fingerprints, visual acceptance and live performance are unresolved until independent testing. The cache bound, per-mounted-category reuse, structural foreign adapter selection, strict native path grammar, and targeted test consolidation are integration-review implementation decisions. No new mechanics or policy decisions were made.
