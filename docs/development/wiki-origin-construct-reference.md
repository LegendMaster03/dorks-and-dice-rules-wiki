# Workstream E — Construct Assembly reference adapter (draft)

Base: Wiki `f0a20a1edde83d48428f36fc8d506c4e04d1f87b`; Core merge `0baa466b7fc8f55e5d675b886f76e95f9a4b551f`. Captured contract fixtures remain pinned to Core `fd0a9b5605429e69a4755cfa45724946818c1243`. The additional source-record fixture contains unmodified JSON record values from the Core merge; filtered aggregate samples are identified by their original paths. Synthetic reverse envelopes in the test are explicitly marked, not actual HTTP evidence.

## Catalog audit

46 path-identified components, 15 native component directory groups; 12 designs, 22 enhancements, 18 materials, 4 power sources, 90 recipes, 8 operational traits and 8 ingredients. Component grouping must use the loader-projected componentCategory, not these source directory names. All component source records were inspected. Current example recipes include structural frame variants and the two-stage alchemical actuator with retained slot material, exact ingredient inputs and an intermediate output. Power sources remain distinct: Solar energy collector, Soul-powered core, Infernal Engine, Mechanical engine.

## Integration ownership

The new module exports `registerConstructRenderers`, `loadConstructIndex`, `renderConstructNavigation` and `CONSTRUCT_TABS`. B owns navigation and the resizable index/detail shell; reuse its lease and exact reader, route selection/back state, and mobile stacking. Register the adapter once from the shared native renderer composition root or reference registration slot after coordination with C/D/F. D owns canonical characteristic detail; exact operational links point to native trait IDs. Add `node tools/test-construct-reference.mjs` to the shared test entry point after owner coordination. No shared modules or workflows changed by this draft. It is deliberately not mounted yet.

## Contract gap

Core ComponentSources only accepts construct-design, construct-enhancement, construct-power-source, construct-material and crafting-recipe. Its recipes collection returns recipes producing the target, not consuming it. Ingredients receive 404. Material slot assignment is not physical suitability or proof of consumption. The adapter therefore displays the reverse-input limitation rather than loading 90 details. Request an additive bounded authoritative recipe-input relationship for exact crafting-material and construct-material IDs, with stage/source-qualified input paths and explicit distinction between fixed ingredient references and conditional slot assignments. No change to Core is authorized by E. B's shared navigation must also be integrated before this branch can be accepted.

## Test status

Dedicated tests use the existing 16 captured A envelopes and the additional exact native source fixture; synthetic empty reverse responses are used only for authored detail cases with no capture. Run `npm ci --ignore-scripts --no-audit --no-fund` then `node tools/test-construct-reference.mjs`. No test execution or browser acceptance is claimed here. Confirm fixture expectations, all current categories, registry integration, real reverse links, mounted responsive layout and stale-context behavior before merge.
