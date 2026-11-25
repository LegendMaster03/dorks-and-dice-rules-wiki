# Character Origins Wiki — B navigation integration

Base: `f0a20a1edde83d48428f36fc8d506c4e04d1f87b`. Core fixture source: the accepted version-1 manifest in `tools/fixtures/origin-reference/`.

## Routes and shared interface

B owns `/rulesets/first-party-001/origins/<view>`; Construct Assembly adds optional `/<section>`. All are presentation routes. Native categories and records keep their existing qualified paths. First-party legacy category /subspecies and /types/subspecies resolve to the native ancestry category; legacy detail IDs are resolved exactly as received, not guessed or silently substituted. Missing historical records retain the native unavailable/error behavior and, on a confirmed 404 for a historical Subspecies identity, receive an explicit explanation and a workspace link. Foreign qualified categories remain untouched.

B owns the ribbon, overview, method reference, secondary Construct navigation, workspace lifecycle, safe fallback family lists, and a native-detail return link based on the resolved rule kind. A capable first-party reader is required for Origins; foreign and older readers retain their original catalog navigation.

The integration owner can assign functions to `app.originWorkspaceRenderers` at composition time:

| Key | Owner |
| --- | --- |
| biological-origination, species-and-ancestries | C |
| characteristics, inheritance-and-transformation | D |
| construct-assembly | E |
| upbringings, backgrounds | F |

Each function receives one frozen input: { reader, context, view, section, lifecycle, hrefForRule, hrefForCategory, hrefForWorkspace }. It returns a detached DOM node or Promise of one. It must use the given authorized reader and lease, check lifecycle.isCurrent before nested async commits, preserve authored status and provenance, and not append a package notice (shell owns one). The fallback uses one bounded hierarchy call per collection or one methods call. Overview resolves the two native rules, not cached review notes. The shell's common divider is applied if a specialized renderer supplies the existing index/detail workspace class. Register specialized native detail renderers separately through the existing native registry; do not replace the detail dispatcher.

The user can navigate from a fallback list to canonical details and back to the appropriate workspace using a return link. Browser back/forward restores the URL through the existing popstate handler. No new authority scope, character state, entitlement, or Core mechanics.

## Testing

Run `node tools/test-origins-navigation.mjs` and `node tools/test-origins-navigation-mounted.mjs` after npm dependencies are installed. The mounted suite runs the actual Wiki application with the pinned reference captures, a simulated private boundary, and existing imported-catalog fixtures. It exercises actual ribbon, history, canonical detail return, legacy aliases, mobile keyboard handling, and foreign isolation. The integration owner should add it to the shared test entry point. It tests captured HTTP hierarchy and method responses using A's actual manifest, direct and legacy route parsing, bounded calls, denied/stale contexts, foreign rejection, and the independently injectable workspace contract. Synthetic composition and error tests are explicitly separate. Existing test suites remain unchanged. The independent branch-only CI workflow runs the standalone test without changing the shared npm test entry point. The owner can remove this workflow after incorporating the standalone test. Overview fixture records are verbatim Core source records from merged commit 0baa466b7fc8f55e5d675b886f76e95f9a4b551f; only their test reader envelopes are synthetic. Hosted desktop/mobile browser and full mounted integration acceptance remain required.

No new Core content, mechanics or transport operations. No production deployment.
