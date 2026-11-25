# Workstream E — Construct Assembly reference adapter (draft)

Base: Wiki `f0a20a1edde83d48428f36fc8d506c4e04d1f87b`; Core merge `0baa466b7fc8f55e5d675b886f76e95f9a4b551f`. Captured contract fixtures remain pinned to Core `fd0a9b5605429e69a4755cfa45724946818c1243`. The additional source-record fixture contains unmodified JSON record values from the Core merge; filtered aggregate samples are identified by their original paths. Synthetic reverse envelopes in the test are explicitly marked, not actual HTTP evidence.

## Catalog audit

46 path-identified components, 15 native component directory groups; 12 designs, 22 enhancements, 18 materials, 4 power sources, 90 recipes, 8 operational traits and 8 ingredients. Component grouping must use the loader-projected componentCategory, not these source directory names. All component source records were inspected. Current example recipes include structural frame variants and the two-stage alchemical actuator with retained slot material, exact ingredient inputs and an intermediate output. Power sources remain distinct: Solar energy collector, Soul-powered core, Infernal Engine, Mechanical engine.

## Integration ownership

The new module exports `registerConstructRenderers`, `loadConstructIndex`, `renderConstructNavigation` `renderConstructIndex`, `renderConstructIngredientLink`, and `CONSTRUCT_TABS`. B owns navigation and the resizable index/detail shell; reuse its lease and exact reader, route selection/back state, and mobile stacking. Register the adapter once from the shared native renderer composition root or reference registration slot after coordination with C/D/F. D owns canonical characteristic detail; exact operational links point to native trait IDs. Add `node tools/test-construct-reference.mjs` to the shared test entry point after owner coordination. No shared modules or workflows changed by this draft. It is deliberately not mounted yet.

## Contract gap

Core ComponentSources only accepts construct-design, construct-enhancement, construct-power-source, construct-material and crafting-recipe. Its recipes collection returns recipes producing the target, not consuming it. Ingredients receive 404. Material slot assignment is not physical suitability or proof of consumption. The adapter therefore displays the reverse-input limitation rather than loading 90 details. Request an additive bounded authoritative recipe-input relationship for exact crafting-material and construct-material IDs, with stage/source-qualified input paths and explicit distinction between fixed ingredient references and conditional slot assignments. No change to Core is authorized by E. The reverse-input extension is a separately acknowledged Workstream A task and does not block integration review of E's unaffected scope.

## Test status

Dedicated tests use the existing 16 captured A envelopes and additional exact native source records. Synthetic empty reverse and component configuration responses are explicitly limited to authored-detail cases with no capture. The test also runs the actual A reader against the captured hierarchy, configuration and reverse envelopes and mounts the adapter through the real presentation lifecycle in an isolated harness. Run `npm ci --ignore-scripts --no-audit --no-fund` then `node tools/test-construct-reference.mjs`. The shared entry point and actual hosted/responsive acceptance belong to the integration owner. No full browser or CI acceptance is claimed here.

## Isolated integration boundary

B may render `renderConstructIndex(input, index, selectedId, {toolBasePath})` or use its own index with the same grouped rows. `loadConstructIndex(reader, kind, lease, {offset,limit})` returns a complete bounded family for the six primary tabs; `crafting-material` is a secondary Materials link and uses ordinary paginated category search. Its page result reports total/offset/limit/complete. B supplies selection/back handling and the existing responsive split workspace. A cancelled read returns null and must not be mounted. Shared registry ownership remains with the integration owner. No changes to shared modules, workflows, or the test entry point.

The selected Core origination rule confirms the provisional 200-point allowance purchases authorized recipe inputs, not finished components. E does not calculate or display component prices. No currently inspected component source record defines operating modes; preserve future authored mode fields and Core-discovered mode IDs without inventing modes. Current structural frame variants are authored and linked.
Index results carry the originating reader context; reject stale results before mounting. An isolated JavaScript execution of the preceding candidate `205a06d3012a995d01e76c6cac9bdbb2dd2403fe` passed 95 assertions using the exact repository source modules, all 16 gzip-decoded (CRC-checked) HTTP captures and the checked-in test body with a minimal emulated DOM/AbortController. This is not jsdom or Chromium evidence. The final candidate adds captured reverse, mounted lifecycle and index-context assertions.
